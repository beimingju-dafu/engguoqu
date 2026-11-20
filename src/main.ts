import './style.css';
import {
  applyQuizResult,
  book,
  emptyProgress,
  gradeQuestion,
  groupBatches,
  groupById,
  loadProgress,
  markStudied,
  mulberry32,
  prepareQuiz,
  saveProgress,
  speechText,
  STORAGE_KEY,
  verbByBase,
  verbs,
  MustStudyError,
  type Question,
  type QuizForm,
  type Response,
} from './logic';
import {
  emptyDraft,
  mascotSvg,
  renderApp,
  type AppSnapshot,
  type MatchDraft,
  type View,
} from './render';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('缺少 #app');

const snapshot: AppSnapshot = {
  frame: 1,
  progress: loadProgress(localStorage),
  confirmReset: false,
  speechNote: false,
  view: { name: 'home' },
};

let timers: number[] = [];

function save(): void {
  saveProgress(localStorage, snapshot.progress);
}

function hush(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function motionOk(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function paintMascot(): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-mascot]')) {
    node.innerHTML = mascotSvg(snapshot.frame);
  }
}

function playMascot(): void {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
  if (!motionOk()) return;
  const frames = [1, 2, 3] as const;
  frames.forEach((frame, index) => {
    timers.push(
      window.setTimeout(() => {
        snapshot.frame = frame;
        paintMascot();
      }, index * 150),
    );
  });
}

function render(mode: 'top' | 'keep' | 'teach' = 'top'): void {
  const y = window.scrollY;
  root!.innerHTML = renderApp(snapshot);
  if (mode === 'keep') window.scrollTo(0, y);
  else if (mode === 'teach') {
    document.querySelector('.teach')?.scrollIntoView({ block: 'nearest' });
    document.querySelector<HTMLElement>('[data-action="next-question"]')?.focus();
  } else window.scrollTo(0, 0);
  const input = document.querySelector<HTMLInputElement>('.answer-input');
  if (input && mode !== 'keep') input.focus();
}

function show(view: View, animate = true): void {
  hush();
  snapshot.speechNote = false;
  snapshot.confirmReset = false;
  snapshot.view = view;
  render();
  if (animate) playMascot();
}

function openGroup(groupId: string): void {
  if (!groupById(groupId)) {
    show({ name: 'home' });
    return;
  }
  show({ name: 'group', groupId });
}

function openLearn(groupId: string, batchIndex: number): void {
  const group = groupById(groupId);
  const batch = group ? groupBatches(group)[batchIndex] : undefined;
  if (!group || !batch) return;
  const firstNew = batch.findIndex((verb) => !snapshot.progress.studied.includes(verb.base));
  show({
    name: 'learn',
    groupId,
    batchIndex,
    cardIndex: firstNew === -1 ? 0 : firstNew,
  });
}

function startQuiz(bases: readonly string[], title: string, groupId: string | null): void {
  try {
    const questions = prepareQuiz(bases, snapshot.progress.studied, mulberry32(Date.now() >>> 0), verbs);
    if (questions.length === 0) {
      show({ name: 'empty-review' });
      return;
    }
    show({
      name: 'quiz',
      title,
      groupId,
      questions,
      index: 0,
      grades: [],
      reveal: null,
      draft: emptyDraft(),
      needAnswer: false,
    });
  } catch (error) {
    if (error instanceof MustStudyError) {
      show({ name: 'blocked', groupId });
      return;
    }
    throw error;
  }
}

function currentQuiz(): Extract<View, { name: 'quiz' }> | null {
  return snapshot.view.name === 'quiz' ? snapshot.view : null;
}

function revealAnswer(response: Response): void {
  const view = currentQuiz();
  if (!view || view.reveal) return;
  const question = view.questions[view.index];
  if (!sameKind(question, response)) return;
  if (response.kind !== 'match' && !response.answer.trim()) {
    snapshot.view = { ...view, needAnswer: true };
    render('keep');
    return;
  }
  const graded = gradeQuestion(question, response, verbByBase);
  snapshot.view = { ...view, reveal: { graded }, needAnswer: false };
  render('teach');
  playMascot();
}

function sameKind(question: Question, response: Response): boolean {
  if (question.kind === 'match') return response.kind === 'match';
  return response.kind === question.kind;
}

function continueQuiz(): void {
  const view = currentQuiz();
  if (!view?.reveal) return;
  const grades = [...view.grades, view.reveal.graded];
  if (view.index + 1 >= view.questions.length) {
    snapshot.progress = applyQuizResult(snapshot.progress, grades);
    save();
    show({ name: 'recap', title: view.title, grades });
    return;
  }
  snapshot.view = {
    ...view,
    grades,
    index: view.index + 1,
    reveal: null,
    draft: emptyDraft(),
    needAnswer: false,
  };
  render();
  playMascot();
}

function placeChip(column: QuizForm, value: string): void {
  const view = currentQuiz();
  if (!view || view.reveal || view.questions[view.index].kind !== 'match') return;
  const draft = cloneDraft(view.draft);
  const placedAt = Object.entries(draft[column]).find(([, placed]) => placed === value)?.[0];
  if (placedAt) delete draft[column][placedAt];
  if (draft.picked?.column === column && draft.picked.value === value && !placedAt) draft.picked = null;
  else draft.picked = { column, value };
  snapshot.view = { ...view, draft, needAnswer: false };
  render('keep');
}

function fillSlot(column: QuizForm, base: string): void {
  const view = currentQuiz();
  if (!view || view.reveal || view.questions[view.index].kind !== 'match') return;
  const draft = cloneDraft(view.draft);
  if (!draft.picked) {
    const value = draft[column][base];
    if (!value) return;
    delete draft[column][base];
    draft.picked = { column, value };
  } else if (draft.picked.column === column) {
    for (const [key, placed] of Object.entries(draft[column])) {
      if (placed === draft.picked.value) delete draft[column][key];
    }
    draft[column][base] = draft.picked.value;
    draft.picked = null;
  } else {
    return;
  }
  snapshot.view = { ...view, draft, needAnswer: false };
  render('keep');
}

function cloneDraft(draft: MatchDraft): MatchDraft {
  return {
    picked: draft.picked ? { ...draft.picked } : null,
    past: { ...draft.past },
    participle: { ...draft.participle },
  };
}

function submitMatch(): void {
  const view = currentQuiz();
  if (!view || view.reveal) return;
  const question = view.questions[view.index];
  if (question.kind !== 'match') return;
  const pairs = question.verbBases.map((base) => ({
    base,
    past: view.draft.past[base] ?? '',
    participle: view.draft.participle[base] ?? '',
  }));
  if (pairs.some((pair) => !pair.past || !pair.participle)) {
    snapshot.view = { ...view, needAnswer: true };
    render('keep');
    return;
  }
  revealAnswer({ kind: 'match', pairs });
}

function speakBase(base: string): void {
  const verb = verbByBase.get(base);
  if (!verb) return;
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
    snapshot.speechNote = true;
    render('keep');
    playMascot();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechText(verb));
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
  playMascot();
}

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!target || !root!.contains(target)) return;
  const action = target.dataset.action ?? '';
  const groupId = target.dataset.group ?? '';
  const batch = Number.parseInt(target.dataset.batch ?? '', 10);

  if (action === 'home') {
    show({ name: 'home' }, false);
    return;
  }
  if (action === 'open-group' && groupId) {
    openGroup(groupId);
    return;
  }
  if (action === 'learn' && groupId && Number.isInteger(batch)) {
    openLearn(groupId, batch);
    return;
  }
  if (action === 'quiz-batch' && groupId && Number.isInteger(batch)) {
    const group = groupById(groupId);
    const verbsInBatch = group ? groupBatches(group)[batch] : undefined;
    if (!group || !verbsInBatch) return;
    startQuiz(
      verbsInBatch.map((verb) => verb.base),
      `${group.name} · 第 ${batch + 1} 叠`,
      group.id,
    );
    return;
  }
  if (action === 'quiz-group' && groupId) {
    const group = groupById(groupId);
    if (!group) return;
    startQuiz(
      group.verbs.map((verb) => verb.base),
      group.name,
      group.id,
    );
    return;
  }
  if (action === 'review') {
    const bases = snapshot.progress.misses.filter((base) => snapshot.progress.studied.includes(base));
    if (bases.length === 0) {
      show({ name: 'empty-review' });
      return;
    }
    startQuiz(bases, '复习错题', null);
    return;
  }
  if (action === 'ack-card' && snapshot.view.name === 'learn') {
    const view = snapshot.view;
    const group = groupById(view.groupId);
    const batchVerbs = group ? groupBatches(group)[view.batchIndex] : undefined;
    if (!group || !batchVerbs) return;
    const verb = batchVerbs[view.cardIndex];
    if (!verb) return;
    snapshot.progress = markStudied(snapshot.progress, [verb.base]);
    save();
    if (view.cardIndex + 1 >= batchVerbs.length) {
      show({ name: 'batch-ready', groupId: group.id, batchIndex: view.batchIndex });
    } else {
      show({ ...view, cardIndex: view.cardIndex + 1 });
    }
    return;
  }
  if (action === 'prev-card' && snapshot.view.name === 'learn' && snapshot.view.cardIndex > 0) {
    show({ ...snapshot.view, cardIndex: snapshot.view.cardIndex - 1 }, false);
    return;
  }
  if (action === 'speak') {
    speakBase(target.dataset.base ?? '');
    return;
  }
  if (action === 'choose') {
    revealAnswer({ kind: 'choice', answer: target.dataset.value ?? '' });
    return;
  }
  if (action === 'pick-chip') {
    const column = target.dataset.column;
    if (column === 'past' || column === 'participle') placeChip(column, target.dataset.value ?? '');
    return;
  }
  if (action === 'fill-slot') {
    const column = target.dataset.column;
    if (column === 'past' || column === 'participle') fillSlot(column, target.dataset.base ?? '');
    return;
  }
  if (action === 'submit-match') {
    submitMatch();
    return;
  }
  if (action === 'next-question') {
    continueQuiz();
    return;
  }
  if (action === 'give-up') {
    const quiz = currentQuiz();
    if (quiz?.groupId) openGroup(quiz.groupId);
    else show({ name: 'home' }, false);
    return;
  }
  if (action === 'reset') {
    if (!snapshot.confirmReset) {
      snapshot.confirmReset = true;
      render('keep');
      return;
    }
    snapshot.progress = emptyProgress();
    snapshot.confirmReset = false;
    localStorage.removeItem(STORAGE_KEY);
    show({ name: 'home' }, false);
  }
}

function onSubmit(event: Event): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.action !== 'submit-type') return;
  event.preventDefault();
  const answer = String(new FormData(form).get('answer') ?? '');
  revealAnswer({ kind: 'type', answer });
}

root.addEventListener('click', onClick);
root.addEventListener('submit', onSubmit);
document.title = book.title;
render();

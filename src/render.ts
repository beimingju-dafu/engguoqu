import {
  book,
  checkAnswer,
  groupBatches,
  groupById,
  groupOf,
  groupStatus,
  recommendedGroupId,
  verbByBase,
  type Graded,
  type GroupStatus,
  type Progress,
  type Question,
  type QuizForm,
} from './logic';

export type Frame = 1 | 2 | 3;

export type MatchDraft = {
  picked: { column: QuizForm; value: string } | null;
  past: Record<string, string>;
  participle: Record<string, string>;
};

export function emptyDraft(): MatchDraft {
  return { picked: null, past: {}, participle: {} };
}

export type View =
  | { name: 'home' }
  | { name: 'group'; groupId: string }
  | { name: 'learn'; groupId: string; batchIndex: number; cardIndex: number }
  | { name: 'batch-ready'; groupId: string; batchIndex: number }
  | {
      name: 'quiz';
      title: string;
      groupId: string | null;
      questions: Question[];
      index: number;
      grades: Graded[];
      reveal: { graded: Graded } | null;
      draft: MatchDraft;
      needAnswer: boolean;
    }
  | { name: 'recap'; title: string; grades: Graded[] }
  | { name: 'empty-review' }
  | { name: 'blocked'; groupId: string | null };

export type AppSnapshot = {
  frame: Frame;
  progress: Progress;
  confirmReset: boolean;
  speechNote: boolean;
  view: View;
};

const SHORT_NAME: Record<string, string> = {
  aaa: '三个一样',
  'abb-ought': 'ought',
  'abb-t': '收成 t',
  'abb-small': '小改一下',
  'abb-vowel': 'ou / oo',
  iau: 'i → a → u',
  'ew-own': 'ew → own',
  'abc-en': '词尾 -en',
  'irregular-unique': '单独死记',
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function mascotSvg(frame: Frame): string {
  const mouth =
    frame === 1
      ? '<path d="M38 52 Q49 60 60 52" fill="none" stroke="#1c1915" stroke-width="4" stroke-linecap="round"/>'
      : frame === 2
        ? '<rect x="40" y="46" width="18" height="12" rx="2" fill="#1c1915"/>'
        : '<rect x="36" y="44" width="26" height="16" rx="3" fill="#1c1915"/>';
  const flame =
    frame === 1
      ? '<rect x="80" y="46" width="12" height="12" fill="#f0a202" stroke="#1c1915" stroke-width="3"/>'
      : frame === 2
        ? '<rect x="78" y="36" width="16" height="22" fill="#f0a202" stroke="#1c1915" stroke-width="3"/>'
        : '<rect x="76" y="24" width="18" height="34" fill="#f0a202" stroke="#1c1915" stroke-width="3"/><rect x="80" y="28" width="6" height="6" fill="#f4ecdc"/>';
  return `<svg class="mascot-svg" viewBox="0 0 104 104" aria-hidden="true">
    <rect x="34" y="8" width="12" height="12" fill="#1c1915"/>
    <rect x="48" y="4" width="14" height="14" fill="#1c1915"/>
    <rect x="64" y="8" width="12" height="12" fill="#1c1915"/>
    <rect x="22" y="16" width="60" height="50" fill="#f4ecdc" stroke="#1c1915" stroke-width="4"/>
    <rect x="34" y="32" width="10" height="14" fill="#1c1915"/>
    <rect x="60" y="32" width="10" height="14" fill="#1c1915"/>
    <rect x="36" y="34" width="4" height="4" fill="#f4ecdc"/>
    <rect x="62" y="34" width="4" height="4" fill="#f4ecdc"/>
    ${mouth}
    <rect x="30" y="62" width="44" height="8" fill="#c4492c" stroke="#1c1915" stroke-width="3"/>
    <rect x="36" y="70" width="28" height="16" fill="#f4ecdc" stroke="#1c1915" stroke-width="4"/>
    <rect x="38" y="86" width="10" height="12" fill="#f4ecdc" stroke="#1c1915" stroke-width="4"/>
    <rect x="54" y="86" width="10" height="12" fill="#f4ecdc" stroke="#1c1915" stroke-width="4"/>
    <rect x="64" y="74" width="16" height="8" fill="#f4ecdc" stroke="#1c1915" stroke-width="3"/>
    <rect x="82" y="56" width="6" height="24" fill="#1c1915"/>
    ${flame}
  </svg>`;
}

function icon(id: string): string {
  const ink = '#1c1915';
  const paper = '#f4ecdc';
  const torch = '#f0a202';
  const leaf = '#3e8f4a';
  const box = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${ink}" stroke-width="2.5"/>`;
  let body = '';
  if (id === 'aaa') body = box(2, 12, 13, 13, paper) + box(17, 12, 13, 13, paper) + box(32, 12, 13, 13, paper);
  else if (id === 'abb-ought') body = box(2, 12, 13, 13, paper) + box(17, 12, 13, 13, torch) + box(32, 12, 13, 13, torch);
  else if (id === 'abb-t') body = box(2, 12, 13, 13, paper) + box(17, 12, 13, 13, leaf) + box(32, 12, 13, 13, leaf);
  else if (id === 'abb-small') body = box(3, 14, 12, 12, paper) + box(18, 12, 13, 13, paper) + box(33, 10, 12, 16, torch);
  else if (id === 'abb-vowel') body = box(2, 12, 13, 13, torch) + box(17, 8, 13, 20, paper) + box(32, 12, 13, 13, torch);
  else if (id === 'iau') body = box(6, 22, 10, 10, paper) + box(18, 14, 12, 18, torch) + box(32, 6, 14, 26, leaf);
  else if (id === 'ew-own') body = box(2, 16, 14, 14, paper) + box(18, 10, 14, 14, torch) + box(30, 18, 14, 8, leaf);
  else if (id === 'abc-en') body = box(2, 12, 13, 13, paper) + box(17, 12, 13, 13, torch) + box(32, 12, 13, 13, leaf);
  else body = box(8, 6, 22, 22, paper) + box(30, 20, 12, 12, '#c4492c');
  return `<svg viewBox="0 0 48 36" aria-hidden="true">${body}</svg>`;
}

function button(label: string, action: string, className = 'btn', attrs = ''): string {
  return `<button type="button" class="${className}" data-action="${escapeHtml(action)}" ${attrs}>${escapeHtml(label)}</button>`;
}

function topbar(title: string, backAction: string, backLabel: string, frame: Frame, attrs = ''): string {
  return `<div class="topbar">
    ${button(backLabel, backAction, 'btn back', attrs)}
    <h1 class="top-title">${escapeHtml(title)}</h1>
    <div class="mascot mascot-sm" data-mascot>${mascotSvg(frame)}</div>
  </div>`;
}

function formCells(base: string): string {
  const verb = verbByBase.get(base);
  if (!verb) return '';
  const cells: Array<[string, string, string]> = [
    ['原形', verb.base, verb.ipa?.base ?? ''],
    ['过去式', verb.past, verb.ipa?.past ?? ''],
    ['过去分词', verb.participle ?? '无', verb.ipa?.participle ?? ''],
  ];
  return `<div class="forms">${cells
    .map(
      ([label, value, ipa]) => `<div class="cell${value === '无' ? ' is-none' : ''}">
        <span class="label">${label}</span>
        <span class="en" lang="en">${escapeHtml(value)}</span>
        ${ipa ? `<span class="ipa">${escapeHtml(ipa)}</span>` : '<span class="ipa"></span>'}
      </div>`,
    )
    .join('')}</div>`;
}

function teachLead(graded: Graded, index: number): string {
  const ok = ['记住了。这个可以进背包。', '对了。写法你抓住了。', '漂亮。再来一个。'];
  const next = ['没关系。看一眼正确的三个写法。', '不规则就是这样，多碰一次就会了。', '先记下这一行，下一题继续。'];
  if (graded.kind === 'match') {
    const hit = graded.results.filter((item) => item.correct).length;
    if (hit === graded.results.length) return ok[index % ok.length];
    if (hit === 0) return next[index % next.length];
    return '有的对上了。剩下的对一下正确写法。';
  }
  return graded.correct ? ok[index % ok.length] : next[index % next.length];
}

function teachPanel(question: Question, graded: Graded, index: number): string {
  const bases = graded.kind === 'match' ? graded.results.map((item) => item.verbBase) : [graded.verbBase];
  const tips: string[] = [];
  const rows = bases
    .map((base) => {
      const verb = verbByBase.get(base);
      if (!verb) return '';
      const group = groupOf(base);
      if (group && !tips.includes(group.tip)) tips.push(group.tip);
      return `<div class="teach-row">
        ${formCells(base)}
        <p class="zh">${escapeHtml(verb.zh)}</p>
        ${verb.note ? `<p class="note">${escapeHtml(verb.note)}</p>` : ''}
        ${button(`朗读 ${verb.base}`, 'speak', 'btn btn-small', `data-base="${escapeHtml(verb.base)}"`)}
      </div>`;
    })
    .join('');
  const tipHtml = tips.map((tip) => `<p class="tip">${escapeHtml(tip)}</p>`).join('');
  let said = '';
  if (graded.kind !== 'match' && !graded.correct && graded.answer.trim()) {
    const label = question.kind === 'choice' ? '你选的是' : '你写的是';
    said = `<p class="said">${label} <span class="en" lang="en">${escapeHtml(graded.answer.trim())}</span></p>`;
  }
  const tag = graded.correct ? '<span class="tag tag-ok">记住了</span>' : '<span class="tag">先看这一行</span>';
  return `<section class="teach" role="status">
    ${tag}
    <p class="teach-lead">${escapeHtml(teachLead(graded, index))}</p>
    ${said}
    ${rows}
    ${tipHtml}
  </section>`;
}

function homeView(snapshot: AppSnapshot): string {
  const { progress, frame } = snapshot;
  const recommended = recommendedGroupId(book.groups, progress);
  const done = book.groups.filter((group) => groupStatus(group, progress).complete).length;
  const reviewPrimary = recommended === null && progress.misses.length > 0;
  const slots = book.groups
    .map((group, index) => {
      const status = groupStatus(group, progress);
      const isNext = group.id === recommended;
      const cls = ['slot', status.complete ? 'is-complete' : '', isNext ? 'is-next' : ''].filter(Boolean).join(' ');
      const pct = Math.round((status.studied / status.total) * 100);
      const meta = status.complete ? `${status.total} 词` : `已看 ${status.studied}/${status.total}`;
      return `<button type="button" class="${cls}" data-action="open-group" data-group="${escapeHtml(group.id)}">
        <span class="slot-top"><span class="slot-no en">${index + 1}</span><span class="kicker">${escapeHtml(kicker(status, isNext))}</span></span>
        <span class="slot-icon">${icon(group.id)}</span>
        <span class="slot-name">${escapeHtml(SHORT_NAME[group.id] ?? group.name)}</span>
        <span class="bar" role="img" aria-label="${escapeHtml(meta)}"><span style="width:${pct}%"></span></span>
        <span class="slot-meta">${escapeHtml(meta)}</span>
      </button>`;
    })
    .join('');
  const missCount = progress.misses.length;
  const reviewClass = ['slot', 'slot-wide', reviewPrimary ? 'is-next' : ''].filter(Boolean).join(' ');
  return `<header class="hero">
      <div class="mascot" data-mascot>${mascotSvg(frame)}</div>
      <div>
        <p class="eyebrow en">IRREGULAR VERBS</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="bubble">先看卡片，再测验。看过的词才出题。</p>
      </div>
    </header>
    <p class="scoreline">已收入 <strong class="en">${done}</strong> / <strong class="en">${book.groups.length}</strong> 组</p>
    <div class="grid">${slots}</div>
    <button type="button" class="${reviewClass}" data-action="review">
      <span>
        <span class="kicker">${reviewPrimary ? '先复习' : '错题背包'}</span>
        <span class="slot-name">复习错题</span>
      </span>
      ${missCount > 0 ? `<span class="count-badge en">${missCount}</span>` : '<span class="slot-meta">空的</span>'}
    </button>
    <p class="foot">${escapeHtml(book.sourceNote)}</p>
    <p class="foot">进度只存在这台设备。</p>
    ${button(snapshot.confirmReset ? '再点一次就清空' : '清空进度', 'reset', snapshot.confirmReset ? 'btn' : 'text-btn')}`;
}

function kicker(status: GroupStatus, recommended: boolean): string {
  if (status.complete) return '已收入';
  if (recommended && status.studied === 0) return '先学';
  if (recommended && !status.ready) return '继续';
  if (recommended && status.ready) return '可测';
  if (status.studied === 0) return '未看';
  if (!status.ready) return '在看';
  return '待测';
}

function groupView(snapshot: AppSnapshot, groupId: string): string {
  const group = groupById(groupId);
  if (!group) return homeView(snapshot);
  const status = groupStatus(group, snapshot.progress);
  const batches = groupBatches(group);
  const nextBatch = batches.findIndex((batch) => batch.some((verb) => !snapshot.progress.studied.includes(verb.base)));
  const rows = batches
    .map((batch, index) => {
      const studied = batch.filter((verb) => snapshot.progress.studied.includes(verb.base)).length;
      const done = studied === batch.length;
      const primary = index === nextBatch;
      const learnLabel = done ? '再看一遍' : studied > 0 ? '继续看' : index === 0 ? '开始看' : '看这叠';
      const learnClass = primary ? 'btn btn-torch' : 'btn';
      return `<li class="batch">
        <div class="batch-head"><strong>第 ${index + 1} 叠</strong><span>${studied}/${batch.length}</span></div>
        <p class="batch-words en" lang="en">${batch.map((verb) => escapeHtml(verb.base)).join(' · ')}</p>
        <p class="batch-gloss">${batch.map((verb) => escapeHtml(verb.zh)).join(' · ')}</p>
        <div class="split">
          ${button(learnLabel, 'learn', learnClass, `data-group="${escapeHtml(group.id)}" data-batch="${index}"`)}
          ${done ? button('测验这叠', 'quiz-batch', 'btn', `data-group="${escapeHtml(group.id)}" data-batch="${index}"`) : ''}
        </div>
      </li>`;
    })
    .join('');
  const fullLabel = status.complete ? '再测验整组' : '测验整组';
  const fullClass = status.ready && !status.complete ? 'btn btn-torch' : 'btn';
  return `${topbar(group.name, 'home', '背包', snapshot.frame)}
    <section class="panel">
      <p class="tip">${escapeHtml(group.tip)}</p>
      ${status.missCount > 0 ? `<p class="fine">这组有 ${status.missCount} 个词在错题背包里。</p>` : ''}
      ${status.ready ? '' : '<p class="fine">看完每一叠，才能测验对应的词。</p>'}
    </section>
    <ol class="batches">${rows}</ol>
    ${
      status.ready
        ? `${group.verbs.length > 8 ? '<p class="fine-on-dark">整组一次测验比较长，也可以一叠一叠来。</p>' : ''}
           ${button(fullLabel, 'quiz-group', fullClass, `data-group="${escapeHtml(group.id)}"`)}`
        : ''
    }`;
}

function learnView(snapshot: AppSnapshot, groupId: string, batchIndex: number, cardIndex: number): string {
  const group = groupById(groupId);
  if (!group) return homeView(snapshot);
  const batch = groupBatches(group)[batchIndex];
  if (!batch) return groupView(snapshot, groupId);
  const verb = batch[Math.min(cardIndex, batch.length - 1)];
  const studied = snapshot.progress.studied.includes(verb.base);
  const last = cardIndex >= batch.length - 1;
  const primary = last ? '这叠看完了' : studied ? '下一张' : '记住了';
  const dots = batch
    .map((_, index) => `<i class="${index < cardIndex ? 'done' : index === cardIndex ? 'on' : ''}"></i>`)
    .join('');
  return `${topbar(group.name, 'open-group', '这组', snapshot.frame, `data-group="${escapeHtml(group.id)}"`)}
    <p class="scoreline">第 <span class="en">${cardIndex + 1}</span> / <span class="en">${batch.length}</span> 张</p>
    <article class="panel card">
      <p class="dots" aria-hidden="true">${dots}</p>
      <p class="zh">${escapeHtml(verb.zh)}</p>
      ${formCells(verb.base)}
      ${verb.note ? `<p class="note">${escapeHtml(verb.note)}</p>` : ''}
      <p class="tip">${escapeHtml(group.tip)}</p>
      ${button('朗读', 'speak', 'btn', `data-base="${escapeHtml(verb.base)}"`)}
      ${snapshot.speechNote ? '<p class="fine">这台浏览器暂时不能朗读，看卡片上的写法就行。</p>' : ''}
    </article>
    <div class="split">
      ${cardIndex > 0 ? button('上一张', 'prev-card') : ''}
      ${button(primary, 'ack-card', 'btn btn-torch')}
    </div>`;
}

function batchReadyView(snapshot: AppSnapshot, groupId: string, batchIndex: number): string {
  const group = groupById(groupId);
  if (!group) return homeView(snapshot);
  const batches = groupBatches(group);
  const batch = batches[batchIndex];
  if (!batch) return groupView(snapshot, groupId);
  const ready = batch.every((verb) => snapshot.progress.studied.includes(verb.base));
  const words = batch
    .map(
      (verb) =>
        `<li><span class="en" lang="en">${escapeHtml(verb.base)} / ${escapeHtml(verb.past)} / ${escapeHtml(verb.participle ?? '无')}</span> · ${escapeHtml(verb.zh)}</li>`,
    )
    .join('');
  return `${topbar(group.name, 'open-group', '这组', snapshot.frame, `data-group="${escapeHtml(group.id)}"`)}
    <section class="panel">
      <h2 class="panel-title">这叠看完了</h2>
      <ul class="word-list">${words}</ul>
    </section>
    <div class="stack">
      ${ready ? button('测验这叠', 'quiz-batch', 'btn btn-torch', `data-group="${escapeHtml(group.id)}" data-batch="${batchIndex}"`) : ''}
      ${batchIndex + 1 < batches.length ? button('看下一叠', 'learn', 'btn', `data-group="${escapeHtml(group.id)}" data-batch="${batchIndex + 1}"`) : ''}
      ${button('回这组', 'open-group', 'btn', `data-group="${escapeHtml(group.id)}"`)}
    </div>`;
}

function quizView(snapshot: AppSnapshot): string {
  const view = snapshot.view;
  if (view.name !== 'quiz') return '';
  const question = view.questions[view.index];
  const stem = question.kind === 'match' ? matchBody(view.draft, question, view.reveal !== null) : singleBody(question, view);
  const reveal = view.reveal ? teachPanel(question, view.reveal.graded, view.index) : '';
  const nextLabel = view.index + 1 >= view.questions.length ? '看结果' : '下一题';
  return `${topbar(view.title, 'give-up', '离开', snapshot.frame)}
    <p class="scoreline">第 <span class="en">${view.index + 1}</span> / <span class="en">${view.questions.length}</span> 题 · 离开不记这轮</p>
    <article class="panel">
      ${stem}
      ${view.needAnswer ? `<p class="nudge">${question.kind === 'match' ? '每个空都放上一个词，再对答案。' : '先写一个答案，写错也没关系。'}</p>` : ''}
    </article>
    ${reveal}
    ${view.reveal ? `<div class="stack">${button(nextLabel, 'next-question', 'btn btn-torch')}</div>` : ''}`;
}

function singleBody(question: Question, view: Extract<View, { name: 'quiz' }>): string {
  if (question.kind === 'match') return '';
  const verb = verbByBase.get(question.verbBase);
  if (!verb) return '';
  const heading = question.form === 'past' ? '过去式是什么？' : '过去分词是什么？';
  let controls = '';
  if (question.kind === 'choice') {
    controls = `<div class="stack">${question.options
      .map((option) => {
        const canonical = option === (question.form === 'past' ? verb.past : verb.participle);
        const picked = view.reveal ? view.reveal.graded.kind !== 'match' && view.reveal.graded.answer === option : false;
        const cls = ['btn', 'choice', view.reveal && canonical ? 'is-correct' : '', picked && !canonical ? 'is-picked' : '']
          .filter(Boolean)
          .join(' ');
        const disabled = view.reveal ? 'disabled' : '';
        return `<button type="button" class="${cls}" data-action="choose" data-value="${escapeHtml(option)}" ${disabled}><span class="en" lang="en">${escapeHtml(option)}</span></button>`;
      })
      .join('')}</div>`;
  } else if (!view.reveal) {
    controls = `<form data-action="submit-type" class="stack">
      <label class="field"><span class="sr">你的答案</span>
        <input class="answer-input en" name="answer" lang="en" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" />
      </label>
      <button type="submit" class="btn btn-torch">确认</button>
    </form>`;
  }
  return `<p class="zh">${escapeHtml(verb.zh)}</p>
    <p class="stem en" lang="en">${escapeHtml(verb.base)}</p>
    <h2 class="ask">${heading}</h2>
    ${controls}`;
}

function matchBody(
  draft: MatchDraft,
  question: Extract<Question, { kind: 'match' }>,
  locked: boolean,
): string {
  const rows = question.verbBases
    .map((base) => {
      const verb = verbByBase.get(base);
      if (!verb) return '';
      return `<div class="match-row">
        <p class="match-base"><span class="en" lang="en">${escapeHtml(verb.base)}</span> · ${escapeHtml(verb.zh)}</p>
        <div class="split">
          ${slotButton('past', '过去式', base, draft, verb, locked)}
          ${slotButton('participle', '过去分词', base, draft, verb, locked)}
        </div>
      </div>`;
    })
    .join('');
  const pastPool = poolButtons('past', '过去式', question.pastChips, draft, locked);
  const partPool = poolButtons('participle', '过去分词', question.participleChips, draft, locked);
  const ready = question.verbBases.every((base) => draft.past[base] && draft.participle[base]);
  return `<h2 class="ask">把三个形式配成一组</h2>
    <p class="fine">${draft.picked ? '再点要放进去的空格。' : '先点下面的词，再点空格。'}</p>
    ${rows}
    ${pastPool}
    ${partPool}
    ${locked ? '' : button('对好了', 'submit-match', ready ? 'btn btn-torch' : 'btn', ready ? '' : 'disabled')}`;
}

function slotButton(
  column: QuizForm,
  label: string,
  base: string,
  draft: MatchDraft,
  verb: NonNullable<ReturnType<typeof verbByBase.get>>,
  locked: boolean,
): string {
  const value = draft[column][base] ?? '';
  let cls = 'gap';
  if (value) cls += ' filled';
  if (locked && value) cls += checkAnswer(verb, column, value) ? ' is-correct' : ' is-quiet';
  const disabled = locked ? 'disabled' : '';
  return `<button type="button" class="${cls}" data-action="fill-slot" data-column="${column}" data-base="${escapeHtml(base)}" ${disabled}>
    <span class="label">${label}</span>
    <span class="en" lang="en">${escapeHtml(value || '放这里')}</span>
  </button>`;
}

function poolButtons(column: QuizForm, label: string, chips: readonly string[], draft: MatchDraft, locked: boolean): string {
  const used = new Set(Object.values(draft[column]));
  const buttons = chips
    .filter((chip) => !used.has(chip))
    .map((chip) => {
      const picked = draft.picked?.column === column && draft.picked.value === chip;
      return `<button type="button" class="chip${picked ? ' is-picked' : ''}" data-action="pick-chip" data-column="${column}" data-value="${escapeHtml(chip)}" ${locked ? 'disabled' : ''}><span class="en" lang="en">${escapeHtml(chip)}</span></button>`;
    })
    .join('');
  return `<div class="pool"><p class="label">${label}</p><div class="chips">${buttons || '<span class="fine">都放好了</span>'}</div></div>`;
}

function recapView(snapshot: AppSnapshot, title: string, grades: Graded[]): string {
  const correct = grades.filter((grade) => grade.correct).length;
  const total = grades.length;
  const missed = new Set<string>();
  for (const grade of grades) {
    if (grade.kind === 'match') {
      for (const result of grade.results) if (!result.correct) missed.add(result.verbBase);
    } else if (!grade.correct) missed.add(grade.verbBase);
  }
  const ratio = total === 0 ? 1 : correct / total;
  const message =
    missed.size === 0
      ? '全部记住了。这轮可以收进背包。'
      : ratio >= 0.8
        ? '大部分记住了。错的几个已经排进复习。'
        : '错题已经排进复习背包。先把那几行看熟。';
  const items = [...missed]
    .map((base) => {
      const verb = verbByBase.get(base);
      if (!verb) return '';
      return `<li class="panel miss">
        <span class="zh">${escapeHtml(verb.zh)}</span>
        <span class="en" lang="en">${escapeHtml(verb.base)} / ${escapeHtml(verb.past)} / ${escapeHtml(verb.participle ?? '无')}</span>
      </li>`;
    })
    .join('');
  const queue = snapshot.progress.misses.length;
  return `${topbar('这轮结束', 'home', '背包', snapshot.frame)}
    <section class="panel recap">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <p class="score"><span class="en">${correct}</span> / <span class="en">${total}</span></p>
      <p>${message}</p>
    </section>
    ${items ? `<h2 class="subhead">这轮要再看的</h2><ul class="miss-list">${items}</ul>` : '<p class="fine-on-dark">这轮没有错题。</p>'}
    <div class="stack">
      ${queue > 0 ? button(`复习错题 ${queue}`, 'review', 'btn btn-torch') : button('回背包', 'home', 'btn btn-torch')}
      ${queue > 0 ? button('回背包', 'home') : ''}
    </div>`;
}

export function renderApp(snapshot: AppSnapshot): string {
  const { view } = snapshot;
  switch (view.name) {
    case 'home':
      return homeView(snapshot);
    case 'group':
      return groupView(snapshot, view.groupId);
    case 'learn':
      return learnView(snapshot, view.groupId, view.batchIndex, view.cardIndex);
    case 'batch-ready':
      return batchReadyView(snapshot, view.groupId, view.batchIndex);
    case 'quiz':
      return quizView(snapshot);
    case 'recap':
      return recapView(snapshot, view.title, view.grades);
    case 'empty-review':
      return `${topbar('复习错题', 'home', '背包', snapshot.frame)}
        <section class="panel">
          <p>错题背包是空的。测验里没对上的词会掉到这里。</p>
        </section>
        <div class="stack">${button('回背包', 'home', 'btn btn-torch')}</div>`;
    case 'blocked':
      return `${topbar('先看卡片', view.groupId ? 'open-group' : 'home', view.groupId ? '这组' : '背包', snapshot.frame, view.groupId ? `data-group="${escapeHtml(view.groupId)}"` : '')}
        <section class="panel">
          <p>这些词还没看过卡片。看完一叠，才能测验这一叠。</p>
        </section>
        <div class="stack">${button(view.groupId ? '回到这组' : '回背包', view.groupId ? 'open-group' : 'home', 'btn btn-torch', view.groupId ? `data-group="${escapeHtml(view.groupId)}"` : '')}</div>`;
    default:
      return homeView(snapshot);
  }
}

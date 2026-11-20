import raw from './data/verbs.json';

export type Verb = {
  base: string;
  past: string;
  participle: string | null;
  zh: string;
  note?: string;
  ipa?: {
    base: string;
    past: string;
    participle: string;
  };
};

export type Group = {
  id: string;
  name: string;
  tip: string;
  verbs: Verb[];
};

export type Book = {
  title: string;
  sourceNote: string;
  groups: Group[];
};

export type QuizForm = 'past' | 'participle';

export type ChoiceQuestion = {
  kind: 'choice';
  verbBase: string;
  form: QuizForm;
  options: string[];
};

export type TypeQuestion = {
  kind: 'type';
  verbBase: string;
  form: QuizForm;
};

export type MatchQuestion = {
  kind: 'match';
  verbBases: [string, string, string];
  pastChips: [string, string, string];
  participleChips: [string, string, string];
};

export type Question = ChoiceQuestion | TypeQuestion | MatchQuestion;

export type Response =
  | { kind: 'choice' | 'type'; answer: string }
  | { kind: 'match'; pairs: Array<{ base: string; past: string; participle: string }> };

export type Graded =
  | {
      kind: 'choice' | 'type';
      verbBase: string;
      form: QuizForm;
      correct: boolean;
      answer: string;
    }
  | {
      kind: 'match';
      correct: boolean;
      results: Array<{ verbBase: string; correct: boolean }>;
    };

export type Progress = {
  studied: string[];
  quizzed: string[];
  misses: string[];
};

export const book = raw as Book;
export const verbs: Verb[] = book.groups.flatMap((group) => group.verbs);
export const verbByBase = new Map(verbs.map((verb) => [verb.base, verb]));

const knownBases = new Set(verbs.map((verb) => verb.base));

export function groupById(id: string): Group | undefined {
  return book.groups.find((group) => group.id === id);
}

export function groupOf(base: string): Group | undefined {
  return book.groups.find((group) => group.verbs.some((verb) => verb.base === base));
}

export class MustStudyError extends Error {
  readonly bases: string[];

  constructor(bases: string[]) {
    super(`先学习再测验: ${bases.join(', ')}`);
    this.name = 'MustStudyError';
    this.bases = bases;
  }
}

/** Forms that may appear in a quiz. can has no participle in the textbook. */
export function formsForQuiz(verb: Verb): QuizForm[] {
  const forms: QuizForm[] = ['past'];
  if (verb.participle !== null) forms.push('participle');
  return forms;
}

export function normalizeAnswer(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '').replace(/／/g, '/');
}

/**
 * be's past is was/were: either word, or both in either order, is correct.
 * Other verbs match the textbook string, case-insensitively.
 */
export function checkAnswer(verb: Verb, form: QuizForm, input: string): boolean {
  const expected = form === 'past' ? verb.past : verb.participle;
  if (expected === null) return false;
  const given = normalizeAnswer(input);
  if (!given) return false;
  if (given === normalizeAnswer(expected)) return true;
  if (expected.includes('/')) {
    const parts = expected.split('/').map((part) => normalizeAnswer(part));
    if (parts.includes(given)) return true;
    if (given === [...parts].reverse().join('/')) return true;
  }
  return false;
}

export function canonicalAnswer(verb: Verb, form: QuizForm): string {
  if (form === 'past') return verb.past;
  if (verb.participle === null) throw new Error(`${verb.base} 没有过去分词`);
  return verb.participle;
}

/** read is spelled the same but said /red/ in the past. can stops after could. */
export function speechText(verb: Verb): string {
  if (verb.base === 'read') return 'read, red, red';
  const past = verb.past.includes('/') ? verb.past.split('/').join(', ') : verb.past;
  if (verb.participle === null) return `${verb.base}, ${past}`;
  return `${verb.base}, ${past}, ${verb.participle}`;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

/**
 * Batches of about 4–5 cards.
 * Counts of 1–5 stay one batch. Larger counts split into pieces of 3, 4, or 5,
 * using 3 only when 4 and 5 cannot fill the group (6, 7, 11, …).
 */
export function planBatchSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 5) return [count];
  const batches = Math.ceil(count / 5);
  const base = Math.floor(count / batches);
  let extra = count % batches;
  const sizes = Array.from({ length: batches }, () => base);
  for (let index = 0; index < sizes.length && extra > 0; index += 1) {
    sizes[index] += 1;
    extra -= 1;
  }
  return sizes;
}

export function groupBatches(group: Group): Verb[][] {
  const sizes = planBatchSizes(group.verbs.length);
  const batches: Verb[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    batches.push(group.verbs.slice(cursor, cursor + size));
    cursor += size;
  }
  return batches;
}

function asTrio(items: string[]): [string, string, string] {
  if (items.length !== 3) throw new Error('需要 3 个形式');
  return [items[0], items[1], items[2]];
}

function choiceOptions(
  verb: Verb,
  form: QuizForm,
  selected: readonly Verb[],
  pool: readonly Verb[],
  rng: () => number,
): string[] {
  const correct = canonicalAnswer(verb, form);
  const seen = new Set<string>([normalizeAnswer(correct)]);
  const distractors: string[] = [];
  const candidates = [
    ...shuffle(selected.filter((item) => item.base !== verb.base), rng),
    ...shuffle(pool.filter((item) => item.base !== verb.base), rng),
  ];
  for (const other of candidates) {
    if (form === 'participle' && other.participle === null) continue;
    const value = form === 'past' ? other.past : (other.participle as string);
    const key = normalizeAnswer(value);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(value);
    if (distractors.length === 3) break;
  }
  return shuffle([correct, ...distractors], rng);
}

export function buildQuiz(
  selected: readonly Verb[],
  rng: () => number,
  pool: readonly Verb[] = verbs,
): Question[] {
  const forms = selected.flatMap((verb) => formsForQuiz(verb).map((form) => ({ verb, form })));
  const questions: Question[] = shuffle(forms, rng).map((item, index) => {
    if (index % 2 === 0) {
      return {
        kind: 'choice' as const,
        verbBase: item.verb.base,
        form: item.form,
        options: choiceOptions(item.verb, item.form, selected, pool, rng),
      };
    }
    return { kind: 'type' as const, verbBase: item.verb.base, form: item.form };
  });

  const matchable = shuffle(selected.filter((verb) => verb.participle !== null), rng);
  if (matchable.length >= 3) {
    const picked = matchable.slice(0, 3);
    const match: MatchQuestion = {
      kind: 'match',
      verbBases: [picked[0].base, picked[1].base, picked[2].base],
      pastChips: asTrio(shuffle(picked.map((verb) => verb.past), rng)),
      participleChips: asTrio(shuffle(picked.map((verb) => verb.participle as string), rng)),
    };
    const at = Math.floor(rng() * (questions.length + 1));
    questions.splice(at, 0, match);
  }
  return questions;
}

export function prepareQuiz(
  bases: readonly string[],
  studied: readonly string[],
  rng: () => number,
  pool: readonly Verb[] = verbs,
): Question[] {
  const wanted = unique(bases);
  const studiedSet = new Set(studied);
  const blocked = wanted.filter((base) => !studiedSet.has(base));
  if (blocked.length > 0) throw new MustStudyError(blocked);
  const selected = wanted.map((base) => {
    const verb = verbByBase.get(base);
    if (!verb) throw new Error(`未知动词: ${base}`);
    return verb;
  });
  return buildQuiz(selected, rng, pool);
}

export function gradeQuestion(
  question: Question,
  response: Response,
  lookup: ReadonlyMap<string, Verb> = verbByBase,
): Graded {
  if (question.kind === 'match') {
    if (response.kind !== 'match') throw new Error('题型不匹配');
    const results = question.verbBases.map((base) => {
      const verb = lookup.get(base);
      if (!verb) throw new Error(`未知动词: ${base}`);
      const pair = response.pairs.find((item) => item.base === base);
      const pastOk = Boolean(pair && checkAnswer(verb, 'past', pair.past));
      const participleOk = Boolean(pair && verb.participle !== null && checkAnswer(verb, 'participle', pair.participle));
      return { verbBase: base, correct: pastOk && participleOk };
    });
    return { kind: 'match', correct: results.every((item) => item.correct), results };
  }
  if (response.kind === 'match') throw new Error('题型不匹配');
  const verb = lookup.get(question.verbBase);
  if (!verb) throw new Error(`未知动词: ${question.verbBase}`);
  return {
    kind: question.kind,
    verbBase: question.verbBase,
    form: question.form,
    correct: checkAnswer(verb, question.form, response.answer),
    answer: response.answer,
  };
}

export function summarize(grades: readonly Graded[]): { correct: number; total: number; missed: string[] } {
  const wrong = new Set<string>();
  let correct = 0;
  for (const grade of grades) {
    if (grade.correct) correct += 1;
    if (grade.kind === 'match') {
      for (const result of grade.results) {
        if (!result.correct) wrong.add(result.verbBase);
      }
    } else if (!grade.correct) {
      wrong.add(grade.verbBase);
    }
  }
  return { correct, total: grades.length, missed: [...wrong] };
}

export function emptyProgress(): Progress {
  return { studied: [], quizzed: [], misses: [] };
}

function unique(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

export function markStudied(progress: Progress, bases: readonly string[]): Progress {
  const extra = bases.filter((base) => knownBases.has(base));
  return { ...progress, studied: unique([...progress.studied, ...extra]) };
}

function verbsIn(grades: readonly Graded[]): string[] {
  const bases: string[] = [];
  for (const grade of grades) {
    if (grade.kind === 'match') {
      for (const result of grade.results) bases.push(result.verbBase);
    } else {
      bases.push(grade.verbBase);
    }
  }
  return unique(bases);
}

export function applyQuizResult(progress: Progress, grades: readonly Graded[]): Progress {
  const { missed } = summarize(grades);
  const involved = new Set(verbsIn(grades));
  const kept = progress.misses.filter((base) => !involved.has(base));
  for (const base of missed) {
    if (!kept.includes(base)) kept.push(base);
  }
  return {
    studied: progress.studied,
    quizzed: unique([...progress.quizzed, ...involved]),
    misses: kept,
  };
}

export type GroupStatus = {
  studied: number;
  quizzed: number;
  total: number;
  missCount: number;
  ready: boolean;
  complete: boolean;
};

export function groupStatus(group: Group, progress: Progress): GroupStatus {
  const bases = group.verbs.map((verb) => verb.base);
  const studied = bases.filter((base) => progress.studied.includes(base)).length;
  const quizzed = bases.filter((base) => progress.quizzed.includes(base)).length;
  const missCount = bases.filter((base) => progress.misses.includes(base)).length;
  const complete = bases.every(
    (base) => progress.studied.includes(base) && progress.quizzed.includes(base) && !progress.misses.includes(base),
  );
  return { studied, quizzed, total: bases.length, missCount, ready: studied === bases.length, complete };
}

/** First group that is not fully collected. Null when every group is complete. */
export function recommendedGroupId(groups: readonly Group[], progress: Progress): string | null {
  for (const group of groups) {
    if (!groupStatus(group, progress).complete) return group.id;
  }
  return null;
}

export const STORAGE_KEY = 'engguoqu-progress-v1';

export function loadProgress(
  storage: Pick<Storage, 'getItem'> | null,
  known: ReadonlySet<string> = knownBases,
): Progress {
  if (!storage) return emptyProgress();
  try {
    const rawText = storage.getItem(STORAGE_KEY);
    if (!rawText) return emptyProgress();
    const data = JSON.parse(rawText) as Partial<Record<keyof Progress, unknown>>;
    const keep = (value: unknown) => {
      if (!Array.isArray(value)) return [];
      return unique(value.filter((item): item is string => typeof item === 'string' && known.has(item)));
    };
    return {
      studied: keep(data.studied),
      quizzed: keep(data.quizzed),
      misses: keep(data.misses),
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: Progress): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

import { describe, expect, it } from 'vitest';
import {
  MustStudyError,
  STORAGE_KEY,
  applyQuizResult,
  book,
  buildQuiz,
  canonicalAnswer,
  checkAnswer,
  emptyProgress,
  formsForQuiz,
  gradeQuestion,
  groupBatches,
  groupStatus,
  loadProgress,
  markStudied,
  mulberry32,
  normalizeAnswer,
  planBatchSizes,
  prepareQuiz,
  recommendedGroupId,
  saveProgress,
  speechText,
  summarize,
  verbByBase,
  verbs,
  type Verb,
} from '../src/logic';

const ROWS = `
cost|cost|cost|花费
cut|cut|cut|切
hit|hit|hit|打
put|put|put|放
read|read|read|读
can|could||能
bring|brought|brought|带来
buy|bought|bought|买
catch|caught|caught|抓住
teach|taught|taught|教
think|thought|thought|想
build|built|built|建造
feel|felt|felt|感觉
keep|kept|kept|保持
leave|left|left|离开
lend|lent|lent|借出
lose|lost|lost|丢失
mean|meant|meant|意思是
meet|met|met|遇见
send|sent|sent|寄送
sleep|slept|slept|睡觉
spend|spent|spent|花费
have|had|had|有
hear|heard|heard|听见
make|made|made|制作
pay|paid|paid|付钱
say|said|said|说
sit|sat|sat|坐
find|found|found|找到
sell|sold|sold|卖
tell|told|told|告诉
stand|stood|stood|站
understand|understood|understood|理解
get|got|got|得到
win|won|won|赢
begin|began|begun|开始
drink|drank|drunk|喝
sing|sang|sung|唱
swim|swam|swum|游泳
draw|drew|drawn|画
fly|flew|flown|飞
grow|grew|grown|生长
know|knew|known|知道
throw|threw|thrown|扔
break|broke|broken|打破
choose|chose|chosen|选择
speak|spoke|spoken|说
wake|woke|woken|醒来
drive|drove|driven|驾驶
ride|rode|ridden|骑
write|wrote|written|写
take|took|taken|拿
forget|forgot|forgotten|忘记
give|gave|given|给
eat|ate|eaten|吃
fall|fell|fallen|落下
see|saw|seen|看见
wear|wore|worn|穿
show|showed|shown|展示
do|did|done|做
lie|lay|lain|躺
be|was/were|been|是
go|went|gone|去
come|came|come|来
become|became|become|变成
run|ran|run|跑
`
  .trim()
  .split('\n');

function memory() {
  const saved = new Map<string, string>();
  return {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
}

function perfectGrades(list: readonly Verb[], seed = 1) {
  const questions = prepareQuiz(
    list.map((verb) => verb.base),
    list.map((verb) => verb.base),
    mulberry32(seed),
  );
  return questions.map((question) => {
    if (question.kind === 'match') {
      return gradeQuestion(question, {
        kind: 'match',
        pairs: question.verbBases.map((base) => {
          const verb = verbByBase.get(base)!;
          return { base, past: verb.past, participle: verb.participle ?? '' };
        }),
      });
    }
    const verb = verbByBase.get(question.verbBase)!;
    const answer = question.form === 'past' ? verb.past : (verb.participle ?? '');
    return gradeQuestion(question, { kind: question.kind, answer });
  });
}

describe('textbook list', () => {
  it('keeps 9 groups and 66 verbs exactly once, in textbook order', () => {
    expect(book.groups).toHaveLength(9);
    expect(book.groups.map((group) => group.id)).toEqual([
      'aaa',
      'abb-ought',
      'abb-t',
      'abb-small',
      'abb-vowel',
      'iau',
      'ew-own',
      'abc-en',
      'irregular-unique',
    ]);
    expect(book.groups.map((group) => group.name)).toEqual([
      '三个都一样',
      '过去式=过分 · ought/aught',
      '过去式=过分 · 词尾收成 t',
      '过去式=过分 · 稍微改一下',
      '过去式=过分 · ou/oo/o',
      'i → a → u',
      'ew → own',
      '三个都变 · 多见 -en/-n',
      '没有规律、单独死记',
    ]);
    expect(verbs).toHaveLength(66);
    expect(new Set(verbs.map((verb) => verb.base)).size).toBe(66);
    expect(verbs.map((verb) => `${verb.base}|${verb.past}|${verb.participle ?? ''}|${verb.zh}`)).toEqual(ROWS);
    expect(verbs).toEqual(book.groups.flatMap((group) => group.verbs));
    for (const group of book.groups) {
      const flat = groupBatches(group).flat();
      expect(flat.map((verb) => verb.base)).toEqual(group.verbs.map((verb) => verb.base));
    }
  });

  it('keeps the textbook exceptions: read, can, get, lie, be', () => {
    expect(verbByBase.get('read')?.ipa).toEqual({ base: '/riːd/', past: '/red/', participle: '/red/' });
    expect(verbByBase.get('can')).toMatchObject({ past: 'could', participle: null, zh: '能' });
    expect(verbByBase.get('can')?.note).toContain('过去分词');
    expect(verbByBase.get('get')).toMatchObject({ past: 'got', participle: 'got', zh: '得到' });
    expect(verbs.some((verb) => verb.past === 'gotten' || verb.participle === 'gotten')).toBe(false);
    expect(verbByBase.get('lie')).toMatchObject({ past: 'lay', participle: 'lain', zh: '躺' });
    expect(verbByBase.get('lie')?.note).toContain('躺');
    expect(verbByBase.get('be')?.past).toBe('was/were');
    expect(verbByBase.get('be')?.participle).toBe('been');
    expect(book.groups.find((group) => group.id === 'aaa')?.tip).toContain('/riːd/');
    expect(book.groups.find((group) => group.id === 'iau')?.tip).toContain('begin began begun');
    expect(book.groups.find((group) => group.id === 'abc-en')?.tip).toContain('lay/lain');
  });
});

describe('batches', () => {
  it('splits groups into chunks of about 4 or 5', () => {
    expect(planBatchSizes(0)).toEqual([]);
    expect(planBatchSizes(4)).toEqual([4]);
    expect(planBatchSizes(5)).toEqual([5]);
    expect(planBatchSizes(6)).toEqual([3, 3]);
    expect(planBatchSizes(11)).toEqual([4, 4, 3]);
    expect(planBatchSizes(17)).toEqual([5, 4, 4, 4]);
    for (let count = 1; count <= 30; count += 1) {
      const sizes = planBatchSizes(count);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(count);
      for (const size of sizes) {
        expect(size).toBeGreaterThanOrEqual(count <= 5 ? 1 : 3);
        expect(size).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('answers', () => {
  const be = verbByBase.get('be')!;
  const get = verbByBase.get('get')!;
  const lie = verbByBase.get('lie')!;
  const can = verbByBase.get('can')!;

  it('accepts was or were for be, and nothing else as the past', () => {
    for (const answer of ['was', 'were', 'was/were', 'were/was', 'WAS', ' Were ', 'was / were', 'was／were']) {
      expect(checkAnswer(be, 'past', answer)).toBe(true);
    }
    for (const answer of ['is', 'been', 'waswere', 'be', '', '   ']) {
      expect(checkAnswer(be, 'past', answer)).toBe(false);
    }
    expect(checkAnswer(be, 'participle', 'been')).toBe(true);
    expect(checkAnswer(be, 'participle', 'Been')).toBe(true);
    expect(checkAnswer(be, 'participle', 'was')).toBe(false);
  });

  it('keeps get/got/got and lie/lay/lain', () => {
    expect(checkAnswer(get, 'past', 'got')).toBe(true);
    expect(checkAnswer(get, 'participle', 'got')).toBe(true);
    expect(checkAnswer(get, 'participle', 'gotten')).toBe(false);
    expect(checkAnswer(lie, 'past', 'lay')).toBe(true);
    expect(checkAnswer(lie, 'past', 'lied')).toBe(false);
    expect(checkAnswer(lie, 'participle', 'lain')).toBe(true);
    expect(checkAnswer(lie, 'participle', 'lied')).toBe(false);
    expect(checkAnswer(verbByBase.get('go')!, 'past', 'went')).toBe(true);
    expect(checkAnswer(verbByBase.get('go')!, 'past', 'goed')).toBe(false);
  });

  it('never offers a participle question for can', () => {
    expect(formsForQuiz(can)).toEqual(['past']);
    expect(formsForQuiz(be)).toEqual(['past', 'participle']);
    expect(() => canonicalAnswer(can, 'participle')).toThrow(/没有过去分词/);
    expect(checkAnswer(can, 'participle', 'could')).toBe(false);
    expect(speechText(can)).toBe('can, could');
    expect(speechText(be)).toBe('be, was, were, been');
    expect(speechText(verbByBase.get('read')!)).toBe('read, red, red');

    for (let seed = 0; seed < 25; seed += 1) {
      const questions = prepareQuiz(['put', 'read', 'can'], ['put', 'read', 'can'], mulberry32(seed));
      expect(questions.some((question) => question.kind === 'match')).toBe(false);
      const aboutCan = questions.filter((question) => question.kind !== 'match' && question.verbBase === 'can');
      expect(aboutCan).toHaveLength(1);
      expect(aboutCan[0]).toMatchObject({ form: 'past' });
    }
  });

  it('builds a deterministic mix and keeps the right answer in every choice', () => {
    const first = buildQuiz(verbs, mulberry32(4));
    expect(buildQuiz(verbs, mulberry32(4))).toEqual(first);
    expect(first.filter((question) => question.kind !== 'match')).toHaveLength(131);
    expect(first.filter((question) => question.kind === 'match')).toHaveLength(1);

    for (let seed = 0; seed < 8; seed += 1) {
      const questions = buildQuiz(verbs, mulberry32(seed));
      for (const question of questions) {
        if (question.kind === 'match') {
          expect(question.verbBases).not.toContain('can');
          expect(new Set(question.verbBases).size).toBe(3);
          continue;
        }
        if (question.verbBase === 'can') expect(question.form).toBe('past');
        if (question.kind === 'choice') {
          const verb = verbByBase.get(question.verbBase)!;
          const keys = question.options.map((option) => normalizeAnswer(option));
          expect(new Set(keys).size).toBe(keys.length);
          expect(keys).toContain(normalizeAnswer(canonicalAnswer(verb, question.form)));
          expect(keys).not.toContain('gotten');
        }
      }
    }
  });

  it('grades choices, typed answers, and partial matches', () => {
    const wrong = gradeQuestion(
      { kind: 'choice', verbBase: 'go', form: 'past', options: ['went', 'gone', 'came'] },
      { kind: 'choice', answer: 'gone' },
    );
    expect(wrong.correct).toBe(false);
    const right = gradeQuestion(
      { kind: 'type', verbBase: 'be', form: 'past' },
      { kind: 'type', answer: 'were' },
    );
    expect(right.correct).toBe(true);

    const match = gradeQuestion(
      {
        kind: 'match',
        verbBases: ['go', 'see', 'do'],
        pastChips: ['went', 'saw', 'did'],
        participleChips: ['gone', 'seen', 'done'],
      },
      {
        kind: 'match',
        pairs: [
          { base: 'go', past: 'went', participle: 'gone' },
          { base: 'see', past: 'saw', participle: 'done' },
          { base: 'do', past: 'did', participle: 'seen' },
        ],
      },
    );
    expect(match.correct).toBe(false);
    if (match.kind !== 'match') throw new Error('expected match grade');
    expect(match.results.find((item) => item.verbBase === 'go')?.correct).toBe(true);
    expect(summarize([wrong, right, match])).toEqual({ correct: 1, total: 3, missed: ['go', 'see', 'do'] });
  });
});

describe('learn before quiz', () => {
  it('refuses verbs that have not been studied, including a finished-group review', () => {
    expect(() => prepareQuiz(['go'], [], mulberry32(1))).toThrow(MustStudyError);
    try {
      prepareQuiz(['go', 'come'], ['go'], mulberry32(1));
      throw new Error('should have refused come');
    } catch (error) {
      expect(error).toBeInstanceOf(MustStudyError);
      expect((error as MustStudyError).bases).toEqual(['come']);
    }

    const unique = book.groups.find((group) => group.id === 'irregular-unique')!;
    const studied = unique.verbs.map((verb) => verb.base);
    const questions = prepareQuiz(studied, studied, mulberry32(2));
    const beForms = questions
      .filter((question) => question.kind !== 'match' && question.verbBase === 'be')
      .map((question) => (question.kind === 'match' ? '' : question.form))
      .sort();
    expect(beForms).toEqual(['participle', 'past']);
    expect(questions.length).toBeGreaterThan(studied.length);
  });

  it('collects a group only after every verb is studied, quizzed, and not in the miss queue', () => {
    const group = book.groups.find((item) => item.id === 'iau')!;
    let progress = emptyProgress();
    expect(recommendedGroupId(book.groups, progress)).toBe('aaa');
    expect(groupStatus(group, progress).complete).toBe(false);

    progress = markStudied(progress, group.verbs.map((verb) => verb.base));
    expect(markStudied(progress, ['go', 'not-a-verb']).studied).toEqual([...group.verbs.map((verb) => verb.base), 'go']);
    expect(groupStatus(group, progress)).toMatchObject({ ready: true, complete: false });

    progress = applyQuizResult(progress, perfectGrades(group.verbs, 3));
    expect(progress.misses).toEqual([]);
    expect(groupStatus(group, progress).complete).toBe(true);

    progress = applyQuizResult(progress, [
      gradeQuestion({ kind: 'type', verbBase: 'sing', form: 'past' }, { kind: 'type', answer: 'sung' }),
    ]);
    expect(progress.misses).toEqual(['sing']);
    expect(groupStatus(group, progress).complete).toBe(false);

    progress = applyQuizResult(progress, [
      gradeQuestion({ kind: 'type', verbBase: 'sing', form: 'past' }, { kind: 'type', answer: 'sang' }),
      gradeQuestion({ kind: 'type', verbBase: 'sing', form: 'participle' }, { kind: 'type', answer: 'sung' }),
    ]);
    expect(progress.misses).toEqual([]);
    expect(groupStatus(group, progress).complete).toBe(true);
  });

  it('drops unknown or broken saved progress', () => {
    const storage = memory();
    saveProgress(storage, { studied: ['go', 'not-a-verb'], quizzed: ['go'], misses: ['go', 'lie'] });
    expect(storage.getItem(STORAGE_KEY)).toContain('go');
    expect(loadProgress(storage)).toEqual({ studied: ['go'], quizzed: ['go'], misses: ['go', 'lie'] });
    storage.setItem(STORAGE_KEY, '{');
    expect(loadProgress(storage)).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
  });
});

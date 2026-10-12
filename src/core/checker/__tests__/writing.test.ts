import type { ExerciseOf } from '../../content/schema';
import { countKeywordGroups } from '../patterns';
import { checkWriting } from '../writing';

const task: ExerciseOf<'write'> = {
  id: 'x.write',
  type: 'write',
  task: 'Напишите о себе.',
  minWords: 5,
  maxWords: 30,
  criteria: [
    { id: 'from', label: 'Откуда', patterns: ['\\bfrom\\b'], required: true },
    { id: 'job', label: 'Профессия', patterns: ["\\b(I'?m|I am) an? [a-z]+"], required: true },
  ],
  commonErrors: [{ pattern: '\\bI from\\b', message: 'Нужен глагол.' }],
  samples: ["I'm Max. I'm from Kazan and I'm a designer."],
  hint: 'Подсказка.',
  explanation: 'Объяснение.',
  difficulty: 3,
  words: [],
  grammar: [],
  troubles: [],
};

describe('checkWriting', () => {
  it('passes a text that meets every criterion', () => {
    const r = checkWriting("Hi! I’m Max, I'm from Kazan. I'm a designer.", task);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
  });

  it('reports missing criteria and typical mistakes', () => {
    const r = checkWriting('Hello! I from Kazan. Nice to meet you.', task);
    expect(r.passed).toBe(false);
    expect(r.criteria.find((c) => c.id === 'job')?.met).toBe(false);
    expect(r.mistakes).toEqual([{ message: 'Нужен глагол.', fragment: 'I from' }]);
  });

  it('flags texts that are too short', () => {
    const r = checkWriting("I'm a cook from Rome.", { ...task, minWords: 10 });
    expect(r.tooShort).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe('countKeywordGroups', () => {
  it('counts each group once, case-insensitively', () => {
    expect(
      countKeywordGroups('MY NAME IS Olga, my name is Olga', [
        ['\\bmy name is\\b'],
        ['\\bfrom\\b'],
      ]),
    ).toBe(1);
  });
});

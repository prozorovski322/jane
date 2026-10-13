import type { UnitBundle } from '../../content/bundle-types';
import { unitLoaders } from '../../content/generated';
import type { Exercise, ExerciseOf } from '../../content/schema';
import { checkExercise, needsRetry, type Response } from '../check';
import { splitTiles } from '../tiles';

const units: UnitBundle[] = Object.values(unitLoaders).map((load) => load());
const allExercises: Exercise[] = units.flatMap((u) => [
  ...u.lessons.flatMap((l) => l.exercises),
  ...u.test.exercises,
]);

/** The response a learner who knows the answer would give. */
function correctResponse(ex: Exercise): Response {
  switch (ex.type) {
    case 'translate_choice':
    case 'listen_choice':
      return { kind: 'choice', index: ex.answer };
    case 'minimal_pair':
      return { kind: 'choice', index: ex.say };
    case 'word_stress':
      return { kind: 'choice', index: ex.stress };
    case 'picture_choice':
      return { kind: 'word', wordId: ex.word };
    case 'tiles':
      return { kind: 'tiles', tiles: splitTiles(ex.answer) };
    case 'type_translation':
      return { kind: 'text', text: ex.answers[0]! };
    case 'listen_dictation':
      return { kind: 'text', text: ex.text };
    case 'match_pairs':
      return { kind: 'pairs', mistakes: 0 };
    case 'fill_gap':
      return { kind: 'gaps', values: ex.answers.map((a) => a[0]!) };
    case 'error_correction':
      return { kind: 'correction', fragment: splitTiles(ex.wrong)[0]!, correction: ex.correction };
    case 'comprehension':
      return { kind: 'answers', answers: ex.questions.map((q) => q.answer) };
    case 'speak_repeat':
      return { kind: 'speech', transcript: ex.text };
    case 'speak_answer':
    case 'speak_describe':
      return { kind: 'speech', transcript: ex.samples[0]! };
    case 'write':
      return { kind: 'text', text: ex.samples[0]! };
  }
}

/** A response that must not be accepted. */
function wrongResponse(ex: Exercise): Response {
  switch (ex.type) {
    case 'translate_choice':
    case 'listen_choice':
      return { kind: 'choice', index: (ex.answer + 1) % ex.options.length };
    case 'minimal_pair':
      return { kind: 'choice', index: 1 - ex.say };
    case 'word_stress':
      return { kind: 'choice', index: (ex.stress + 1) % ex.syllables.length };
    case 'picture_choice':
      return { kind: 'word', wordId: ex.distractors[0]! };
    case 'tiles':
      return { kind: 'tiles', tiles: splitTiles(ex.answer).reverse() };
    case 'type_translation':
    case 'listen_dictation':
    case 'write':
      return { kind: 'text', text: 'xyz' };
    case 'match_pairs':
      return { kind: 'pairs', mistakes: 10 };
    case 'fill_gap':
      return { kind: 'gaps', values: ex.answers.map(() => 'xyz') };
    case 'error_correction':
      return { kind: 'correction', fragment: 'xyz', correction: 'xyz' };
    case 'comprehension':
      return { kind: 'answers', answers: ex.questions.map(() => null) };
    case 'speak_repeat':
    case 'speak_answer':
    case 'speak_describe':
      return { kind: 'speech', transcript: 'xyz' };
  }
}

describe('every exercise in the course', () => {
  it.each(allExercises.map((e) => [e.id, e] as const))(
    '%s accepts its own correct answer',
    (_id, ex) => {
      const v = checkExercise(ex, correctResponse(ex));
      expect(v.correct).toBe(true);
      expect(v.score).toBeGreaterThanOrEqual(0.9);
    },
  );

  it.each(allExercises.filter((e) => e.type !== 'match_pairs').map((e) => [e.id, e] as const))(
    '%s rejects a wrong answer',
    (_id, ex) => {
      const v = checkExercise(ex, wrongResponse(ex));
      expect(v.correct).toBe(false);
    },
  );
});

const base = {
  hint: 'Подсказка.',
  explanation: 'Объяснение.',
  difficulty: 1 as const,
  words: [],
  grammar: [],
  troubles: [],
};

describe('checkExercise details', () => {
  it('accepts a full form where the answer uses a contraction', () => {
    const ex: ExerciseOf<'type_translation'> = {
      ...base,
      id: 'x.1',
      type: 'type_translation',
      from: 'ru',
      text: 'Она медсестра.',
      answers: ["She's a nurse."],
    };
    expect(checkExercise(ex, { kind: 'text', text: 'she is a nurse' }).quality).toBe('perfect');
    const typo = checkExercise(ex, { kind: 'text', text: "She's a nrse" });
    expect(typo.quality).toBe('typo');
    expect(typo.correct).toBe(true);
  });

  it('accepts alternative tile orders and rejects distractors', () => {
    const ex: ExerciseOf<'tiles'> = {
      ...base,
      id: 'x.2',
      type: 'tiles',
      from: 'ru',
      text: 'Я тоже студент.',
      answer: "I'm a student too.",
      alternatives: ["I'm too a student."],
      distractors: ['an'],
    };
    expect(
      checkExercise(ex, { kind: 'tiles', tiles: ["I'm", 'too', 'a', 'student'] }).correct,
    ).toBe(true);
    expect(
      checkExercise(ex, { kind: 'tiles', tiles: ["I'm", 'an', 'student', 'too'] }).correct,
    ).toBe(false);
  });

  it('scores comprehension per question', () => {
    const ex = allExercises.find(
      (e): e is ExerciseOf<'comprehension'> => e.type === 'comprehension',
    )!;
    const answers = ex.questions.map((q) => q.answer) as (
      number | 'true' | 'false' | 'not_given' | null
    )[];
    answers[0] = null;
    const v = checkExercise(ex, { kind: 'answers', answers });
    expect(v.correct).toBe(false);
    expect(v.parts?.[0]).toBe(false);
    expect(v.quality).toBe('partial');
    expect(needsRetry(v)).toBe(false);
  });

  it('counts match-pair mistakes in the score but not as a failure', () => {
    const ex = allExercises.find((e) => e.type === 'match_pairs')!;
    const v = checkExercise(ex, { kind: 'pairs', mistakes: 2 });
    expect(v).toMatchObject({ correct: true, quality: 'partial' });
    expect(v.score).toBeCloseTo(0.6);
  });

  it('error correction needs both the right fragment and the right fix', () => {
    const ex = allExercises.find(
      (e): e is ExerciseOf<'error_correction'> => e.type === 'error_correction',
    )!;
    const v = checkExercise(ex, { kind: 'correction', fragment: ex.wrong, correction: 'xyz' });
    expect(v.correct).toBe(false);
    expect(v.parts).toEqual([true, false]);
  });

  it('accepts self-assessment for speaking with a reduced score', () => {
    const ex = allExercises.find((e) => e.type === 'speak_repeat')!;
    expect(checkExercise(ex, { kind: 'self', ok: true })).toMatchObject({
      correct: true,
      quality: 'self',
      score: 0.7,
    });
  });

  it('accepts a typed answer instead of speech', () => {
    const ex = allExercises.find(
      (e): e is ExerciseOf<'speak_answer'> => e.type === 'speak_answer',
    )!;
    expect(checkExercise(ex, { kind: 'text', text: ex.samples[0]! }).correct).toBe(true);
  });

  it('throws on a response of the wrong kind', () => {
    const ex = allExercises.find((e) => e.type === 'tiles')!;
    expect(() => checkExercise(ex, { kind: 'choice', index: 0 })).toThrow(/does not fit/);
  });
});

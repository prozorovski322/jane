import { getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';

import {
  canSkip,
  createLesson,
  currentItem,
  makeReducer,
  progress,
  summarize,
  type LessonAction,
  type LessonState,
} from '../engine';

const reduce = makeReducer();
const unit = getUnit('a1.u01');
const vocab = unit.lessons[0]!; // translate, pictures, pairs, tiles…
const listening = unit.lessons[4]!;

function run(state: LessonState, ...actions: LessonAction[]): LessonState {
  return actions.reduce(reduce, state);
}

const pick = (type: Exercise['type']) => vocab.exercises.find((e) => e.type === type)!;

describe('lesson engine', () => {
  it('walks through every exercise and finishes', () => {
    let s = createLesson(vocab.id, [pick('translate_choice')], { now: 0 });
    expect(currentItem(s)?.exercise.type).toBe('translate_choice');
    s = run(s, { type: 'answer', response: { kind: 'choice', index: 0 } });
    expect(s.phase).toBe('feedback');
    expect(s.verdict?.correct).toBe(true);
    s = run(s, { type: 'continue', now: 5000 });
    expect(s.phase).toBe('done');
    expect(summarize(s)).toMatchObject({
      total: 1,
      answered: 1,
      correctFirstTry: 1,
      accuracy: 1,
      durationMs: 5000,
    });
  });

  it('brings a wrong answer back once at the end', () => {
    const a = pick('translate_choice');
    const b = pick('picture_choice');
    let s = createLesson(vocab.id, [a, b]);
    s = run(s, { type: 'answer', response: { kind: 'choice', index: 1 } }, { type: 'continue' });
    expect(s.queue.map((q) => q.exercise.id)).toEqual([a.id, b.id, a.id]);
    s = run(
      s,
      { type: 'answer', response: { kind: 'word', wordId: 'hello' } },
      { type: 'continue' },
      // The retry is wrong again: it does not come back a third time.
      { type: 'answer', response: { kind: 'choice', index: 2 } },
      { type: 'continue' },
    );
    expect(s.phase).toBe('done');
    expect(s.queue).toHaveLength(3);
    const summary = summarize(s);
    expect(summary.total).toBe(2);
    expect(summary.correctFirstTry).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.outcomes.find((o) => o.exerciseId === a.id)?.correct).toBe(false);
  });

  it('measures accuracy on the first attempt even if the retry is right', () => {
    const a = pick('translate_choice');
    let s = createLesson(vocab.id, [a]);
    s = run(
      s,
      { type: 'answer', response: { kind: 'choice', index: 1 } },
      { type: 'continue' },
      { type: 'answer', response: { kind: 'choice', index: 0 } },
      { type: 'continue' },
    );
    expect(s.records[a.id]).toMatchObject({
      attempts: 2,
      first: { correct: false },
      last: { correct: true },
    });
    expect(summarize(s).accuracy).toBe(0);
  });

  it('lets the learner skip listening when they cannot listen, without a penalty', () => {
    const listen = listening.exercises.find((e) => e.type === 'listen_dictation')!;
    const tiles = listening.exercises.find((e) => e.type === 'tiles')!;
    let s = createLesson(listening.id, [listen, tiles]);
    expect(run(s, { type: 'skip', reason: 'cant-speak' })).toBe(s); // not a speaking exercise
    s = run(s, { type: 'skip', reason: 'cant-listen' });
    expect(currentItem(s)?.exercise.id).toBe(tiles.id);
    s = run(
      s,
      { type: 'answer', response: { kind: 'tiles', tiles: ['Откуда', 'ты', 'Я', 'из', 'Казани'] } },
      { type: 'continue' },
    );
    expect(summarize(s)).toMatchObject({ total: 2, answered: 1, skipped: 1, accuracy: 1 });
  });

  it('ignores actions that do not fit the phase', () => {
    const s = createLesson(vocab.id, [pick('translate_choice')]);
    expect(run(s, { type: 'continue' })).toBe(s);
    const answered = run(s, { type: 'answer', response: { kind: 'choice', index: 0 } });
    expect(run(answered, { type: 'answer', response: { kind: 'choice', index: 1 } })).toBe(
      answered,
    );
  });

  it('records hint usage', () => {
    const a = pick('translate_choice');
    const s = run(
      createLesson(vocab.id, [a]),
      { type: 'hint' },
      { type: 'answer', response: { kind: 'choice', index: 0 } },
      { type: 'continue' },
    );
    expect(summarize(s).outcomes[0]?.usedHint).toBe(true);
  });

  it('progress grows monotonically to 1', () => {
    let s = createLesson(vocab.id, vocab.exercises.slice(0, 2));
    const seen = [progress(s)];
    s = run(s, { type: 'answer', response: { kind: 'word', wordId: 'xyz' } });
    seen.push(progress(s));
    s = run(s, { type: 'continue' });
    seen.push(progress(s));
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeGreaterThan(0);
    expect(progress({ ...s, phase: 'done' })).toBe(1);
  });

  it('leaves out mastered exercises but keeps a minimum', () => {
    const s = createLesson(vocab.id, vocab.exercises, { skip: () => true, minExercises: 4 });
    expect(s.queue.map((q) => q.exercise.id)).toEqual(vocab.exercises.slice(0, 4).map((e) => e.id));
    const t = createLesson(vocab.id, vocab.exercises, { skip: (e) => e.type === 'match_pairs' });
    expect(t.queue.some((q) => q.exercise.type === 'match_pairs')).toBe(false);
  });

  it('knows which exercises can be skipped for which reason', () => {
    const comprehension = listening.exercises.find((e) => e.type === 'comprehension')!;
    expect(canSkip(comprehension, 'cant-listen')).toBe(true);
    expect(canSkip(pick('speak_repeat'), 'cant-speak')).toBe(true);
    expect(canSkip(pick('tiles'), 'cant-listen')).toBe(false);
  });
});

import type { Snapshot } from '../backup';
import { BACKUP_TABLES } from '../backup';
import { mergeSnapshots, sameData } from '../merge';

type Tables = Partial<Snapshot['tables']>;

function snap(tables: Tables): Snapshot {
  const all = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t] ?? []]));
  return {
    app: 'jane',
    schema: 5,
    exportedAt: '2026-10-19T00:00:00Z',
    tables: all as Snapshot['tables'],
  };
}

const result = (id: number, lesson: string, at: number) => ({
  id,
  lesson_id: lesson,
  unit_id: 'a1.u01',
  kind: 'lesson',
  started_at: at - 60_000,
  finished_at: at,
  day: '2026-10-19',
  total: 10,
  answered: 10,
  correct: 9,
  accuracy: 0.9,
  score: 0.9,
  xp: 20,
  passed: 1,
});
const attempt = (id: number, resultId: number, ex: string, at: number) => ({
  id,
  result_id: resultId,
  exercise_id: ex,
  skill: 'vocabulary',
  correct: 1,
  score: 1,
  used_hint: 0,
  words: '[]',
  grammar: '[]',
  troubles: '[]',
  at,
});

// Phone: lesson l01. Computer: lesson l02. Both started from the same account (lesson l00).
const shared = result(1, 'a1.u01.l00', 1_000_000);
const phone = snap({
  lesson_results: [shared, result(2, 'a1.u01.l01', 2_000_000)],
  attempts: [attempt(1, 1, 'e00', 999_000), attempt(2, 2, 'e01', 1_999_000)],
  lesson_progress: [
    {
      lesson_id: 'a1.u01.l01',
      unit_id: 'a1.u01',
      first_completed_at: 2_000_000,
      last_completed_at: 2_000_000,
      best_score: 0.8,
      passed: 1,
      times: 1,
      source: 'lesson',
    },
  ],
  daily_activity: [{ day: '2026-10-19', xp: 40, lessons: 2, reviews: 0, seconds: 300 }],
  kv: [{ key: 'settings.theme', value: '"dark"' }],
  certificates: [{ level: 'A1', earned_at: 5, score: 0.7, source: 'placement' }],
});
const computer = snap({
  lesson_results: [{ ...shared, id: 7 }, result(8, 'a1.u01.l02', 3_000_000)],
  attempts: [attempt(4, 7, 'e00', 999_000), attempt(5, 8, 'e02', 2_999_000)],
  lesson_progress: [
    {
      lesson_id: 'a1.u01.l01',
      unit_id: 'a1.u01',
      first_completed_at: 1_500_000,
      last_completed_at: 1_500_000,
      best_score: 0.95,
      passed: 1,
      times: 1,
      source: 'placement',
    },
    {
      lesson_id: 'a1.u01.l02',
      unit_id: 'a1.u01',
      first_completed_at: 3_000_000,
      last_completed_at: 3_000_000,
      best_score: 1,
      passed: 1,
      times: 1,
      source: 'lesson',
    },
  ],
  daily_activity: [{ day: '2026-10-19', xp: 60, lessons: 3, reviews: 1, seconds: 200 }],
  kv: [
    { key: 'settings.theme', value: '"light"' },
    { key: 'onboarding', value: '{"done":true}' },
  ],
  certificates: [{ level: 'A1', earned_at: 9, score: 0.8, source: 'exam' }],
});

describe('mergeSnapshots', () => {
  const merged = mergeSnapshots(phone, computer);

  it('keeps the sessions of both devices once each, with their answers', () => {
    expect(merged.tables.lesson_results.map((r) => r.lesson_id)).toEqual([
      'a1.u01.l00',
      'a1.u01.l01',
      'a1.u01.l02',
    ]);
    const idOf = (lesson: string) =>
      merged.tables.lesson_results.find((r) => r.lesson_id === lesson)!.id;
    const exercisesOf = (lesson: string) =>
      merged.tables.attempts.filter((a) => a.result_id === idOf(lesson)).map((a) => a.exercise_id);
    expect(exercisesOf('a1.u01.l00')).toEqual(['e00']);
    expect(exercisesOf('a1.u01.l01')).toEqual(['e01']);
    expect(exercisesOf('a1.u01.l02')).toEqual(['e02']);
  });

  it('resolves towards more progress', () => {
    const l01 = merged.tables.lesson_progress.find((r) => r.lesson_id === 'a1.u01.l01')!;
    expect(l01).toMatchObject({
      best_score: 0.95,
      first_completed_at: 1_500_000,
      source: 'lesson',
    });
    expect(merged.tables.lesson_progress).toHaveLength(2);
    expect(merged.tables.daily_activity[0]).toMatchObject({
      xp: 60,
      lessons: 3,
      reviews: 1,
      seconds: 300,
    });
    expect(merged.tables.certificates[0]).toMatchObject({ source: 'exam', score: 0.8 });
  });

  it("keeps this device's settings and takes what is missing from the account", () => {
    const kv = Object.fromEntries(merged.tables.kv.map((r) => [r.key, r.value]));
    expect(kv['settings.theme']).toBe('"dark"');
    expect(kv.onboarding).toBe('{"done":true}');
  });

  it('changes nothing when merged again', () => {
    expect(sameData(mergeSnapshots(merged, computer), merged)).toBe(true);
    expect(sameData(mergeSnapshots(merged, merged), merged)).toBe(true);
    expect(sameData(mergeSnapshots(phone, phone), mergeSnapshots(phone, snap({})))).toBe(true);
  });

  it('takes the review card reviewed last', () => {
    const card = (lastReview: number, reps: number) => ({
      id: 'word:hello',
      kind: 'word',
      ref: 'hello',
      due: 1,
      stability: 1,
      difficulty: 1,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps,
      lapses: 0,
      state: 2,
      last_review: lastReview,
      created_at: 1,
    });
    const m = mergeSnapshots(
      snap({ srs_cards: [card(10, 5)] }),
      snap({ srs_cards: [card(20, 3)] }),
    );
    expect(m.tables.srs_cards[0]).toMatchObject({ last_review: 20, reps: 3 });
  });
});

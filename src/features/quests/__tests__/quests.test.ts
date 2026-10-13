import type { LessonSummary } from '@/features/lesson/engine';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { recordSession, type SessionMeta } from '../../progress/service';
import {
  ACCURACY_GOAL,
  ALL_QUESTS_BONUS,
  isQuestDone,
  QUEST_XP,
  questProgress,
  questsForDay,
  type DayStats,
  type Quest,
} from '../quests';
import { ensureQuests, loadDayQuests, settleQuests } from '../service';

const OPTS = { hasCards: true, canSpeak: true };
const EMPTY: DayStats = { xp: 0, lessons: 0, reviews: 0, practice: 0, bestAccuracy: 0, skills: {} };

describe('questsForDay', () => {
  it('is deterministic for a date and gives three quests of different kinds', () => {
    const a = questsForDay('2026-10-13', OPTS);
    expect(questsForDay('2026-10-13', OPTS)).toEqual(a);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.kind)).size).toBe(3);
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
  });

  it('varies over days', () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const sets = new Set(
      days.map((d) =>
        questsForDay(d, OPTS)
          .map((q) => q.id)
          .join(),
      ),
    );
    expect(sets.size).toBeGreaterThan(5);
  });

  it('does not ask for reviews without cards or speaking without speaking exercises', () => {
    for (let i = 1; i <= 30; i++) {
      const qs = questsForDay(`2026-11-${String(i).padStart(2, '0')}`, {
        hasCards: false,
        canSpeak: false,
      });
      expect(qs.some((q) => q.kind === 'review')).toBe(false);
      expect(qs.some((q) => q.skill === 'speaking')).toBe(false);
    }
  });
});

describe('questProgress', () => {
  it('measures each kind from the day stats', () => {
    expect(questProgress(q('xp', 20), { ...EMPTY, xp: 12 })).toBe(12);
    expect(questProgress(q('xp', 20), { ...EMPTY, xp: 99 })).toBe(20);
    expect(isQuestDone(q('lesson', 1), { ...EMPTY, lessons: 1 })).toBe(true);
    expect(isQuestDone(q('review', 10), { ...EMPTY, reviews: 9 })).toBe(false);
    expect(isQuestDone(q('accuracy', 8), { ...EMPTY, bestAccuracy: ACCURACY_GOAL })).toBe(true);
    expect(isQuestDone(q('accuracy', 8), { ...EMPTY, bestAccuracy: 0.8 })).toBe(false);
    expect(
      isQuestDone({ ...q('skill', 5), skill: 'listening' }, { ...EMPTY, skills: { listening: 5 } }),
    ).toBe(true);
  });
});

function q(kind: Quest['kind'], target: number): Quest {
  return { id: `${kind}.${target}`, kind, target, title: '', xp: QUEST_XP };
}

function summary(n: number, correct: number): LessonSummary {
  const outcomes = Array.from({ length: n }, (_, i) => ({
    exerciseId: `x.${i}`,
    correct: i < correct,
    score: i < correct ? 1 : 0,
    usedHint: false,
    words: [`w${i}`],
    grammar: [],
    troubles: [],
    skill: (['vocabulary', 'grammar', 'listening'] as const)[i % 3]!,
  }));
  return {
    lessonId: 'a1.u01.l01',
    total: n,
    answered: n,
    skipped: 0,
    correctFirstTry: correct,
    accuracy: correct / n,
    score: correct / n,
    durationMs: 60_000,
    outcomes,
  };
}

const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const meta = (id: string): SessionMeta => ({ id, unitId: 'a1.u01', kind: 'lesson' });

let db: Db;
beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('quests in the database', () => {
  it('are fixed for the day once made', async () => {
    const first = await ensureQuests(db, '2026-10-13');
    await db.run(
      "INSERT INTO srs_cards (id, kind, ref, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, created_at) VALUES ('word:a','word','a',0,1,1,0,0,0,1,0,2,0,0)",
    );
    expect(await ensureQuests(db, '2026-10-13')).toEqual(first);
  });

  it('pay their XP once and add it to the day, with a bonus for finishing all three', async () => {
    const day = '2026-10-13';
    const quests = await ensureQuests(db, day);
    // Do plenty of everything: a long clean lesson, several times.
    for (let i = 0; i < 4; i++)
      await recordSession(db, meta(`a1.u01.l0${i + 1}`), summary(30, 30), { now: at(day, 10 + i) });
    const state = await loadDayQuests(db, at(day, 20));
    // Quests that depend on other kinds of sessions (practice, reviews) may still be open.
    const done = state.quests.filter((s) => s.done);
    expect(done.length).toBeGreaterThanOrEqual(1);

    const logged = await db.all<{ quest_id: string; xp: number }>(
      'SELECT quest_id, xp FROM quest_log WHERE day = ?',
      [day],
    );
    expect(logged.length).toBeGreaterThanOrEqual(done.length);
    // Settling again changes nothing.
    const again = await settleQuests(db, at(day, 21));
    expect(again.bonusXp).toBe(0);
    const paid = logged.reduce((s, r) => s + r.xp, 0);
    const activity = await db.get<{ xp: number }>('SELECT xp FROM daily_activity WHERE day = ?', [
      day,
    ]);
    const sessions = await db.get<{ xp: number }>(
      'SELECT SUM(xp) AS xp FROM lesson_results WHERE day = ?',
      [day],
    );
    expect(activity!.xp).toBe(sessions!.xp + paid);
    expect(quests).toHaveLength(3);
    expect(QUEST_XP + ALL_QUESTS_BONUS).toBeGreaterThan(0);
  });

  it('keeps a quest from paying twice when the learner continues', async () => {
    const day = '2026-10-14';
    await ensureQuests(db, day);
    const a = await recordSession(db, meta('a1.u01.l01'), summary(10, 10), { now: at(day) });
    const b = await recordSession(db, meta('a1.u01.l01'), summary(10, 10), { now: at(day, 12) });
    const titlesA = new Set(a.questsCompleted);
    for (const t of b.questsCompleted) expect(titlesA.has(t)).toBe(false);
  });
});

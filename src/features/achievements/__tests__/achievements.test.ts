import type { LessonSummary } from '@/features/lesson/engine';
import type { Skill } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { recordSession, type SessionMeta } from '../../progress/service';
import {
  ACHIEVEMENTS,
  achievementStates,
  newlyUnlocked,
  type AchievementStats,
} from '../definitions';
import { evaluateAchievements, loadAchievements, loadAchievementStats } from '../service';

const ZERO: AchievementStats = {
  xp: 0,
  streak: 0,
  lessons: 0,
  tests: 0,
  perfect: 0,
  units: 0,
  levels: 0,
  reviews: 0,
  wordsMastered: 0,
  wordsLearning: 0,
  activeDays: 0,
  goalDays: 0,
  listening: 0,
  speaking: 0,
  writing: 0,
  reading: 0,
  ownWords: 0,
  favorites: 0,
  quests: 0,
  early: 0,
  night: 0,
  weekend: 0,
  comebacks: 0,
  placement: 0,
  freezesUsed: 0,
};

describe('achievement definitions', () => {
  it('has at least 30 achievements with unique ids and sensible thresholds', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.target).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.description).toMatch(/[.!]$/);
      expect(a.metric in ZERO).toBe(true);
    }
  });

  it('every metric is reachable by at least one achievement and none is unlocked at zero', () => {
    expect(newlyUnlocked(ZERO, new Set())).toEqual([]);
  });

  it('unlocks by threshold, only once', () => {
    const stats = { ...ZERO, lessons: 5, xp: 120 };
    const first = newlyUnlocked(stats, new Set()).map((a) => a.id);
    expect(first).toEqual(expect.arrayContaining(['first-lesson', 'lessons-5', 'xp-100']));
    expect(first).not.toContain('lessons-25');
    expect(newlyUnlocked(stats, new Set(first))).toEqual([]);
  });

  it('shows progress capped at the target', () => {
    const states = achievementStates({ ...ZERO, lessons: 12 }, new Map([['first-lesson', 5]]));
    const l25 = states.find((s) => s.id === 'lessons-25')!;
    expect(l25.value).toBe(12);
    expect(l25.unlockedAt).toBeNull();
    expect(states.find((s) => s.id === 'lessons-5')!.value).toBe(5);
    expect(states.find((s) => s.id === 'first-lesson')!.unlockedAt).toBe(5);
  });
});

const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

function summary(n: number, correct: number, skill: Skill = 'vocabulary'): LessonSummary {
  const outcomes = Array.from({ length: n }, (_, i) => ({
    exerciseId: `x.${i}`,
    correct: i < correct,
    score: i < correct ? 1 : 0,
    usedHint: false,
    words: [],
    grammar: [],
    troubles: [],
    skill,
  }));
  return {
    lessonId: 'a1.u01.l01',
    total: n,
    answered: n,
    skipped: 0,
    correctFirstTry: correct,
    accuracy: n ? correct / n : 0,
    score: n ? correct / n : 0,
    durationMs: 60_000,
    outcomes,
  };
}

let db: Db;
beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});
afterEach(() => db.close());

const lesson = (id: string): SessionMeta => ({ id, unitId: 'a1.u01', kind: 'lesson' });

describe('achievements from the database', () => {
  it('starts empty', async () => {
    const stats = await loadAchievementStats(db, at('2026-10-13'));
    expect(stats).toEqual(ZERO);
  });

  it('unlocks the first lesson, a perfect lesson and XP milestones when a session is recorded', async () => {
    const info = await recordSession(db, lesson('a1.u01.l01'), summary(10, 10), {
      now: at('2026-10-13'),
    });
    const ids = info.achievements.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(['first-lesson', 'perfect-1', 'xp-100'].slice(0, 2)),
    );
    // Recording the same state again unlocks nothing new.
    expect(await evaluateAchievements(db, at('2026-10-13'))).toEqual([]);
    const listed = await loadAchievements(db, at('2026-10-13'));
    expect(listed.find((a) => a.id === 'first-lesson')!.unlockedAt).not.toBeNull();
    expect(listed.find((a) => a.id === 'lessons-5')!.unlockedAt).toBeNull();
  });

  it('counts early and night sessions, weekends and comebacks', async () => {
    // 2026-10-10 is a Saturday.
    await recordSession(db, lesson('a1.u01.l01'), summary(6, 5), { now: at('2026-10-10', 7) });
    await recordSession(db, lesson('a1.u01.l02'), summary(6, 5), { now: at('2026-10-12', 23) });
    await recordSession(db, lesson('a1.u01.l03'), summary(6, 5), { now: at('2026-10-25', 12) });
    const stats = await loadAchievementStats(db, at('2026-10-25', 13));
    expect(stats.early).toBe(1);
    expect(stats.night).toBe(1);
    expect(stats.weekend).toBeGreaterThanOrEqual(1);
    expect(stats.comebacks).toBe(1);
    expect(stats.lessons).toBe(3);
    const ids = (await loadAchievements(db, at('2026-10-25', 13)))
      .filter((a) => a.unlockedAt)
      .map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['early-bird', 'night-owl', 'comeback']));
  });

  it('counts answers per skill', async () => {
    await recordSession(db, lesson('a1.u01.l01'), summary(5, 5, 'listening'), {
      now: at('2026-10-13'),
    });
    expect((await loadAchievementStats(db, at('2026-10-13'))).listening).toBe(5);
  });
});

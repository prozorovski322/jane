import type { Skill } from '@/core/content/schema';
import { addDays, dayOf, type Day } from '@/core/progress/dates';
import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';

import {
  ACCURACY_MIN_ANSWERS,
  ALL_QUESTS_BONUS,
  isQuestDone,
  questProgress,
  questsForDay,
  type DayStats,
  type Quest,
} from './quests';

const key = (day: Day) => `quests.${day}`;
/** Quest id of the extra reward for finishing all of the day's quests. */
export const BONUS_ID = 'bonus';

export async function loadDayStats(db: Db, day: Day): Promise<DayStats> {
  const sum = await db.get<{ xp: number; lessons: number; practice: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp,
            COALESCE(SUM(kind IN ('lesson', 'test')), 0) AS lessons,
            COALESCE(SUM(kind = 'practice'), 0) AS practice
     FROM lesson_results WHERE day = ?`,
    [day],
  );
  const reviews = await db.get<{ n: number }>(
    'SELECT COALESCE(SUM(reviews), 0) AS n FROM daily_activity WHERE day = ?',
    [day],
  );
  const best = await db.get<{ a: number }>(
    'SELECT COALESCE(MAX(accuracy), 0) AS a FROM lesson_results WHERE day = ? AND answered >= ?',
    [day, ACCURACY_MIN_ANSWERS],
  );
  const bySkill = await db.all<{ skill: Skill; n: number }>(
    `SELECT a.skill AS skill, COUNT(*) AS n FROM attempts a
     JOIN lesson_results r ON r.id = a.result_id WHERE r.day = ? GROUP BY a.skill`,
    [day],
  );
  return {
    xp: sum?.xp ?? 0,
    lessons: sum?.lessons ?? 0,
    reviews: reviews?.n ?? 0,
    practice: sum?.practice ?? 0,
    bestAccuracy: best?.a ?? 0,
    skills: Object.fromEntries(bySkill.map((r) => [r.skill, r.n])),
  };
}

/** The day's quests: made once, then kept so they do not change while the learner plays. */
export async function ensureQuests(db: Db, day: Day): Promise<Quest[]> {
  const saved = await kvGet<Quest[] | null>(db, key(day), null);
  if (saved?.length) return saved;
  const cards = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM srs_cards');
  const spoke = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM attempts WHERE skill = 'speaking'",
  );
  const quests = questsForDay(day, {
    hasCards: (cards?.n ?? 0) > 0,
    canSpeak: (spoke?.n ?? 0) > 0,
  });
  await kvSet(db, key(day), quests);
  await db.run('DELETE FROM kv WHERE key LIKE ? AND key < ?', ['quests.%', key(addDays(day, -14))]);
  return quests;
}

export interface QuestState {
  quest: Quest;
  progress: number;
  done: boolean;
}

export interface DayQuests {
  quests: QuestState[];
  /** Extra reward for finishing every quest of the day was received. */
  allDone: boolean;
}

export async function loadDayQuests(db: Db, now = new Date()): Promise<DayQuests> {
  const day = dayOf(now);
  const quests = await ensureQuests(db, day);
  const stats = await loadDayStats(db, day);
  const logged = new Set(
    (await db.all<{ quest_id: string }>('SELECT quest_id FROM quest_log WHERE day = ?', [day])).map(
      (r) => r.quest_id,
    ),
  );
  return {
    quests: quests.map((q) => ({
      quest: q,
      progress: questProgress(q, stats),
      done: logged.has(q.id) || isQuestDone(q, stats),
    })),
    allDone: logged.has(BONUS_ID),
  };
}

export interface QuestReward {
  completed: Quest[];
  /** All of the day's quests are now done (for the first time). */
  allDone: boolean;
  bonusXp: number;
}

/**
 * Records quests that became complete and pays their bonus XP into today's activity.
 * Idempotent: a quest pays once per day.
 */
export async function settleQuests(db: Db, now = new Date()): Promise<QuestReward> {
  const day = dayOf(now);
  const quests = await ensureQuests(db, day);
  const stats = await loadDayStats(db, day);
  const logged = new Set(
    (await db.all<{ quest_id: string }>('SELECT quest_id FROM quest_log WHERE day = ?', [day])).map(
      (r) => r.quest_id,
    ),
  );

  const completed = quests.filter((q) => !logged.has(q.id) && isQuestDone(q, stats));
  let bonusXp = completed.reduce((s, q) => s + q.xp, 0);
  const allDone =
    !logged.has(BONUS_ID) && quests.every((q) => logged.has(q.id) || completed.includes(q));
  if (allDone) bonusXp += ALL_QUESTS_BONUS;
  if (!completed.length && !allDone) return { completed, allDone: false, bonusXp: 0 };

  await db.transaction(async () => {
    for (const q of completed) {
      await db.run(
        'INSERT OR IGNORE INTO quest_log (day, quest_id, completed_at, xp) VALUES (?, ?, ?, ?)',
        [day, q.id, now.getTime(), q.xp],
      );
    }
    if (allDone) {
      await db.run(
        'INSERT OR IGNORE INTO quest_log (day, quest_id, completed_at, xp) VALUES (?, ?, ?, ?)',
        [day, BONUS_ID, now.getTime(), ALL_QUESTS_BONUS],
      );
    }
    await db.run(
      `INSERT INTO daily_activity (day, xp) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET xp = xp + excluded.xp`,
      [day, bonusXp],
    );
  });
  return { completed, allDone, bonusXp };
}

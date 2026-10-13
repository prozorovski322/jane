/**
 * Turns a finished session (lesson, unit test, review) into stored progress: result and attempts,
 * lesson completion, XP and daily activity, streak and freezes, spaced-repetition cards.
 * All writes of one session happen in one transaction.
 */
import type { FSRS, Grade } from 'ts-fsrs';

import type { Level } from '@/core/content/schema';
import { addDays, dayOf, type Day } from '@/core/progress/dates';
import { currentStreak, freezesEarned, freezesNeeded, START_FREEZES } from '@/core/progress/streak';
import { dailyGoalXp, sessionXp, type SessionKind } from '@/core/progress/xp';
import {
  cardId,
  createScheduler,
  newCard,
  ratingFor,
  review,
  worstRating,
  type CardKind,
} from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';
import { getCards, logReview, saveCard } from '@/core/storage/srs-repo';

import { evaluateAchievements } from '../achievements/service';
import { awardExamCertificate } from '../certificates/service';
import { parseExamId } from '../exams/exam';
import type { LessonSummary } from '../lesson/engine';
import { settleQuests } from '../quests/service';
import { dailyMinutes, setDailyMinutes } from './goal';

export interface SessionMeta {
  /** Lesson id, unit test id ("a1.u01.test") or a session id for reviews ("review"). */
  id: string;
  unitId: string | null;
  kind: SessionKind;
  /** Unit tests: minimum mean score to pass. */
  passScore?: number;
}

export interface CompletionInfo {
  xp: number;
  totalXp: number;
  todayXp: number;
  goalXp: number;
  goalJustReached: boolean;
  streak: number;
  streakExtended: boolean;
  freezes: number;
  freezeEarned: boolean;
  passed: boolean;
  /** Cards created or rescheduled by this session. */
  cardsUpdated: number;
  /** The level whose certificate this session earned (a passed level exam), if any. */
  certificate: Level | null;
  /** Extra XP from quests completed by this session (not included in `xp`). */
  bonusXp: number;
  /** Titles of the daily quests this session completed. */
  questsCompleted: string[];
  allQuestsDone: boolean;
  /** Achievements unlocked by this session. */
  achievements: { id: string; title: string }[];
}

const KEY_FREEZES = 'streak.freezes';

export { dailyMinutes, setDailyMinutes };

export interface StreakState {
  streak: number;
  freezes: number;
  todayActive: boolean;
}

async function countedDays(db: Db) {
  const active = new Set(
    (await db.all<{ day: string }>('SELECT day FROM daily_activity WHERE xp > 0')).map(
      (r) => r.day,
    ),
  );
  const frozen = new Set(
    (await db.all<{ day: string }>('SELECT day FROM streak_freezes')).map((r) => r.day),
  );
  return { active, frozen };
}

/**
 * Called when the app opens and before recording a session: covers days missed since the last
 * activity with freezes, if there are enough of them.
 */
export async function prepareDay(db: Db, now: Date): Promise<StreakState> {
  const today = dayOf(now);
  const { active, frozen } = await countedDays(db);
  let freezes = await kvGet(db, KEY_FREEZES, START_FREEZES);

  const last =
    [...active, ...frozen]
      .filter((d) => d < today)
      .sort()
      .at(-1) ?? null;
  const toFreeze = freezesNeeded(last, today, freezes);
  if (toFreeze.length) {
    await db.transaction(async () => {
      for (const d of toFreeze) {
        await db.run('INSERT OR IGNORE INTO streak_freezes (day, used_at) VALUES (?, ?)', [
          d,
          now.getTime(),
        ]);
        frozen.add(d);
      }
      freezes -= toFreeze.length;
      await kvSet(db, KEY_FREEZES, freezes);
    });
  }
  return { streak: currentStreak(active, frozen, today), freezes, todayActive: active.has(today) };
}

/** Groups first-attempt outcomes by card and picks the weakest rating per card. */
function cardRatings(
  summary: LessonSummary,
): Map<string, { kind: CardKind; ref: string; rating: Grade }> {
  const byCard = new Map<string, { kind: CardKind; ref: string; ratings: Grade[] }>();
  for (const o of summary.outcomes) {
    const rating = ratingFor(o);
    const refs: [CardKind, string][] = [
      ...o.words.map((w) => ['word', w] as [CardKind, string]),
      ...o.grammar.map((g) => ['grammar', g] as [CardKind, string]),
    ];
    for (const [kind, ref] of refs) {
      const id = cardId(kind, ref);
      const entry = byCard.get(id) ?? { kind, ref, ratings: [] };
      entry.ratings.push(rating);
      byCard.set(id, entry);
    }
  }
  return new Map(
    [...byCard].map(([id, e]) => [
      id,
      { kind: e.kind, ref: e.ref, rating: worstRating(e.ratings) },
    ]),
  );
}

export async function recordSession(
  db: Db,
  meta: SessionMeta,
  summary: LessonSummary,
  opts: { now?: Date; scheduler?: FSRS } = {},
): Promise<CompletionInfo> {
  const now = opts.now ?? new Date();
  const scheduler = opts.scheduler ?? createScheduler();
  const today: Day = dayOf(now);

  const before = await prepareDay(db, now);
  const goalXp = dailyGoalXp(await dailyMinutes(db));
  const todayBefore =
    (await db.get<{ xp: number }>('SELECT xp FROM daily_activity WHERE day = ?', [today]))?.xp ?? 0;

  const passed = meta.kind === 'test' ? summary.score >= (meta.passScore ?? 0) : true;
  const exam = meta.kind === 'test' ? parseExamId(meta.id) : null;
  const xp = sessionXp({
    kind: meta.kind,
    answered: summary.answered,
    correctFirstTry: summary.correctFirstTry,
    accuracy: summary.accuracy,
    passed,
  });
  const ratings = cardRatings(summary);

  await db.transaction(async () => {
    const started = now.getTime() - summary.durationMs;
    const { lastInsertRowId: resultId } = await db.run(
      `INSERT INTO lesson_results (lesson_id, unit_id, kind, started_at, finished_at, day, total, answered,
         correct, accuracy, score, xp, passed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meta.id,
        meta.unitId,
        meta.kind,
        started,
        now.getTime(),
        today,
        summary.total,
        summary.answered,
        summary.correctFirstTry,
        summary.accuracy,
        summary.score,
        xp,
        passed ? 1 : 0,
      ],
    );

    for (const o of summary.outcomes) {
      await db.run(
        `INSERT INTO attempts (result_id, exercise_id, skill, correct, score, used_hint, words, grammar, troubles, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resultId,
          o.exerciseId,
          o.skill,
          o.correct ? 1 : 0,
          o.score,
          o.usedHint ? 1 : 0,
          JSON.stringify(o.words),
          JSON.stringify(o.grammar),
          JSON.stringify(o.troubles),
          now.getTime(),
        ],
      );
    }

    // Passing a level exam earns the level's certificate.
    if (exam?.kind === 'level' && passed && summary.answered > 0) {
      await awardExamCertificate(db, exam.level, summary.score, now);
    }

    if ((meta.kind === 'lesson' || meta.kind === 'test') && meta.unitId && summary.answered > 0) {
      await db.run(
        `INSERT INTO lesson_progress (lesson_id, unit_id, first_completed_at, last_completed_at, best_score, passed, times)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT (lesson_id) DO UPDATE SET
           last_completed_at = excluded.last_completed_at,
           best_score = MAX(best_score, excluded.best_score),
           passed = MAX(passed, excluded.passed),
           times = times + 1,
           source = 'lesson'`,
        [meta.id, meta.unitId, now.getTime(), now.getTime(), summary.score, passed ? 1 : 0],
      );
    }

    await db.run(
      `INSERT INTO daily_activity (day, xp, lessons, reviews, seconds) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (day) DO UPDATE SET
         xp = xp + excluded.xp, lessons = lessons + excluded.lessons,
         reviews = reviews + excluded.reviews, seconds = seconds + excluded.seconds`,
      [
        today,
        xp,
        meta.kind === 'review' ? 0 : 1,
        meta.kind === 'review' ? summary.answered : 0,
        Math.round(summary.durationMs / 1000),
      ],
    );

    const existing = await getCards(db, [...ratings.keys()]);
    for (const [id, { kind, ref, rating }] of ratings) {
      const card = existing.get(id) ?? newCard(kind, ref, now);
      const next = review(scheduler, card, rating, now);
      await saveCard(db, next.card);
      await logReview(db, id, next.log);
    }
  });

  // Streak after the session.
  const { active, frozen } = await countedDays(db);
  const streak = currentStreak(active, frozen, today);
  const earned = freezesEarned(before.streak, streak, before.freezes);
  if (earned) await kvSet(db, KEY_FREEZES, before.freezes + earned);

  // Quests pay a little extra XP; achievements unlock from the finished session's totals.
  const reward = await settleQuests(db, now);
  const unlocked = await evaluateAchievements(db, now);

  const totalXp =
    (await db.get<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity'))?.xp ??
    0;
  const todayXp = todayBefore + xp + reward.bonusXp;

  return {
    xp,
    totalXp,
    todayXp,
    goalXp,
    goalJustReached: todayBefore < goalXp && todayXp >= goalXp,
    streak,
    streakExtended: streak > before.streak,
    freezes: before.freezes + earned,
    freezeEarned: earned > 0,
    passed,
    cardsUpdated: ratings.size,
    certificate: exam?.kind === 'level' && passed && summary.answered > 0 ? exam.level : null,
    bonusXp: reward.bonusXp,
    questsCompleted: reward.completed.map((q) => q.title),
    allQuestsDone: reward.allDone,
    achievements: unlocked.map((a) => ({ id: a.id, title: a.title })),
  };
}

export interface ProgressSnapshot {
  totalXp: number;
  todayXp: number;
  goalXp: number;
  streak: number;
  freezes: number;
  completedLessons: Set<string>;
  /** Last 35 days of activity for the calendar, oldest first. */
  calendar: { day: Day; xp: number; frozen: boolean }[];
}

export async function loadProgress(db: Db, now: Date = new Date()): Promise<ProgressSnapshot> {
  const streak = await prepareDay(db, now);
  const today = dayOf(now);
  const from = addDays(today, -34);
  const activity = await db.all<{ day: string; xp: number }>(
    'SELECT day, xp FROM daily_activity WHERE day >= ?',
    [from],
  );
  const frozen = new Set(
    (await db.all<{ day: string }>('SELECT day FROM streak_freezes WHERE day >= ?', [from])).map(
      (r) => r.day,
    ),
  );
  const xpByDay = new Map(activity.map((a) => [a.day, a.xp]));
  const totalXp =
    (await db.get<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity'))?.xp ??
    0;
  const completed = await db.all<{ lesson_id: string }>(
    'SELECT lesson_id FROM lesson_progress WHERE passed = 1',
  );
  return {
    totalXp,
    todayXp: xpByDay.get(today) ?? 0,
    goalXp: dailyGoalXp(await dailyMinutes(db)),
    streak: streak.streak,
    freezes: streak.freezes,
    completedLessons: new Set(completed.map((r) => r.lesson_id)),
    calendar: Array.from({ length: 35 }, (_, i) => {
      const day = addDays(from, i);
      return { day, xp: xpByDay.get(day) ?? 0, frozen: frozen.has(day) };
    }),
  };
}

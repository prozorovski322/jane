import { getCourse } from '@/core/content';
import { daysBetween, dayOf, parseDay } from '@/core/progress/dates';
import { currentStreak, longestStreak } from '@/core/progress/streak';
import { dailyGoalXp } from '@/core/progress/xp';
import { isMastered } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { allCards } from '@/core/storage/srs-repo';

import { lastPlacement } from '../placement/apply';
import { dailyMinutes } from '../progress/goal';
import {
  achievementStates,
  newlyUnlocked,
  type Achievement,
  type AchievementState,
  type AchievementStats,
} from './definitions';

const count = async (db: Db, sql: string, params: (string | number)[] = []) =>
  (await db.get<{ n: number }>(sql, params))?.n ?? 0;

/** Counts of a unit's passed lessons, by unit and level, for the "course" achievements. */
function courseCompletion(passed: ReadonlySet<string>) {
  let units = 0;
  let levels = 0;
  for (const level of getCourse().levels) {
    let levelDone = level.units.length > 0;
    for (const u of level.units) {
      const done = [...u.lessons.map((l) => l.id), `${u.id}.test`].every((id) => passed.has(id));
      if (done) units++;
      else levelDone = false;
    }
    if (levelDone) levels++;
  }
  return { units, levels };
}

export async function loadAchievementStats(db: Db, now = new Date()): Promise<AchievementStats> {
  const activity = await db.all<{ day: string; xp: number }>(
    'SELECT day, xp FROM daily_activity WHERE xp > 0 ORDER BY day',
  );
  const activeDays = activity.map((r) => r.day);
  const frozen = new Set(
    (await db.all<{ day: string }>('SELECT day FROM streak_freezes')).map((r) => r.day),
  );
  const goal = dailyGoalXp(await dailyMinutes(db));

  const progress = await db.all<{ lesson_id: string }>(
    "SELECT lesson_id FROM lesson_progress WHERE passed = 1 AND source = 'lesson'",
  );
  const passed = new Set(progress.map((p) => p.lesson_id));
  const { units, levels } = courseCompletion(passed);

  const skillCounts = new Map(
    (
      await db.all<{ skill: string; n: number }>(
        'SELECT skill, COUNT(*) AS n FROM attempts GROUP BY skill',
      )
    ).map((r) => [r.skill, r.n]),
  );
  const finished = await db.all<{ finished_at: number }>(
    "SELECT finished_at FROM lesson_results WHERE kind IN ('lesson', 'test', 'practice')",
  );
  const hours = finished.map((r) => new Date(r.finished_at).getHours());

  // A comeback: the learner returns after a gap of a week or more between two active days.
  let comebacks = 0;
  for (let i = 1; i < activeDays.length; i++) {
    if (daysBetween(activeDays[i - 1]!, activeDays[i]!) >= 7) comebacks++;
  }

  const cards = await allCards(db);
  const words = cards.filter((c) => c.kind === 'word');
  const activeSet = new Set(activeDays);

  return {
    xp: activity.reduce((s, r) => s + r.xp, 0),
    streak: Math.max(
      longestStreak(activeSet, frozen),
      currentStreak(activeSet, frozen, dayOf(now)),
    ),
    lessons: [...passed].filter((id) => !id.endsWith('.test')).length,
    tests: [...passed].filter((id) => id.endsWith('.test')).length,
    perfect: await count(
      db,
      "SELECT COUNT(*) AS n FROM lesson_results WHERE kind IN ('lesson', 'test') AND accuracy = 1 AND answered >= 5",
    ),
    units,
    levels,
    reviews: await count(db, 'SELECT COALESCE(SUM(reviews), 0) AS n FROM daily_activity'),
    wordsMastered: words.filter(isMastered).length,
    wordsLearning: words.length,
    activeDays: activeDays.length,
    goalDays: activity.filter((r) => r.xp >= goal).length,
    listening: skillCounts.get('listening') ?? 0,
    speaking: skillCounts.get('speaking') ?? 0,
    writing: skillCounts.get('writing') ?? 0,
    reading: skillCounts.get('reading') ?? 0,
    ownWords: await count(db, 'SELECT COUNT(*) AS n FROM user_words'),
    favorites: await count(db, 'SELECT COUNT(*) AS n FROM favorites'),
    quests: await count(db, "SELECT COUNT(*) AS n FROM quest_log WHERE quest_id <> 'bonus'"),
    early: hours.filter((h) => h < 8).length,
    night: hours.filter((h) => h >= 22).length,
    weekend: activeDays.filter((d) => [0, 6].includes(parseDay(d).getDay())).length,
    comebacks,
    placement: (await lastPlacement(db)) ? 1 : 0,
    freezesUsed: frozen.size,
  };
}

async function unlockedMap(db: Db): Promise<Map<string, number>> {
  return new Map(
    (
      await db.all<{ id: string; unlocked_at: number }>('SELECT id, unlocked_at FROM achievements')
    ).map((r) => [r.id, r.unlocked_at]),
  );
}

/** Unlocks everything whose threshold is reached; returns what was newly unlocked. */
export async function evaluateAchievements(db: Db, now = new Date()): Promise<Achievement[]> {
  const stats = await loadAchievementStats(db, now);
  const fresh = newlyUnlocked(stats, new Set((await unlockedMap(db)).keys()));
  for (const a of fresh) {
    await db.run('INSERT OR IGNORE INTO achievements (id, unlocked_at) VALUES (?, ?)', [
      a.id,
      now.getTime(),
    ]);
  }
  return fresh;
}

export async function loadAchievements(db: Db, now = new Date()): Promise<AchievementState[]> {
  return achievementStates(await loadAchievementStats(db, now), await unlockedMap(db));
}

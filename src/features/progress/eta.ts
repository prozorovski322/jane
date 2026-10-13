/**
 * "How long until the next level?" from the learner's own pace. It is an estimate for planning,
 * not a promise; with too little history it says nothing rather than guess.
 */
import { getCourse } from '@/core/content';
import { addDays, dayOf } from '@/core/progress/dates';
import type { Db } from '@/core/storage/db';

const WINDOW_DAYS = 14;
/** Fewer lessons than this in the window is too little to extrapolate. */
const MIN_LESSONS = 3;

/** Lessons and unit tests left in a level, counting only written units. */
export function remainingInLevel(level: string, completed: ReadonlySet<string>): number {
  const info = getCourse().levels.find((l) => l.level === level);
  if (!info) return 0;
  return info.units
    .flatMap((u) => [...u.lessons.map((l) => l.id), `${u.id}.test`])
    .filter((id) => !completed.has(id)).length;
}

/** Weeks to finish `remaining` lessons at the pace of the last two weeks, or null if unknown. */
export function estimateWeeks(remaining: number, lessonsInWindow: number): number | null {
  if (remaining <= 0 || lessonsInWindow < MIN_LESSONS) return null;
  const perWeek = (lessonsInWindow / WINDOW_DAYS) * 7;
  return Math.max(1, Math.ceil(remaining / perWeek));
}

export async function lessonsInLastTwoWeeks(db: Db, now = new Date()): Promise<number> {
  const since = addDays(dayOf(now), -(WINDOW_DAYS - 1));
  const row = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM lesson_results WHERE kind = 'lesson' AND day >= ?",
    [since],
  );
  return row?.n ?? 0;
}

/** "около недели", "около 2 недель", "около 21 недели": the number after «около» is genitive. */
export function weeksPhrase(weeks: number): string {
  if (weeks === 1) return 'около недели';
  const word = weeks % 10 === 1 && weeks % 100 !== 11 ? 'недели' : 'недель';
  return `около ${weeks} ${word}`;
}

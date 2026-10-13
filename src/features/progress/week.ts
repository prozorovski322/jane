import { addDays, type Day } from '@/core/progress/dates';
import {
  summarizeWeek,
  weekDays,
  type WeekActivityRow,
  type WeekSummary,
} from '@/core/progress/week';
import type { Db } from '@/core/storage/db';

/** Summary of the week starting on `start` (a Monday). */
export async function loadWeekSummary(db: Db, start: Day): Promise<WeekSummary> {
  const days = weekDays(start);
  const last = days[6]!;
  const rows = await db.all<WeekActivityRow>(
    'SELECT day, xp, lessons, reviews, seconds FROM daily_activity WHERE day >= ? AND day <= ?',
    [start, last],
  );
  const previous = await db.get<{ xp: number }>(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity WHERE day >= ? AND day < ?',
    [addDays(start, -7), start],
  );
  const answers = await db.get<{ n: number; c: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(a.correct), 0) AS c FROM attempts a
     JOIN lesson_results r ON r.id = a.result_id WHERE r.day >= ? AND r.day <= ?`,
    [start, last],
  );
  return summarizeWeek(start, rows, previous?.xp ?? 0, {
    n: answers?.n ?? 0,
    correct: answers?.c ?? 0,
  });
}

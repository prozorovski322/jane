/** Weeks run Monday to Sunday, in the learner's local calendar. */
import { addDays, parseDay, type Day } from './dates';

/** Monday of the week that contains `day`. */
export function weekStart(day: Day): Day {
  const dow = parseDay(day).getDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export function weekDays(start: Day): Day[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const DEFAULT_WEEKLY_GOAL = 4;
export const WEEKLY_GOAL_OPTIONS = [2, 3, 4, 5, 6, 7] as const;

export interface WeekSummary {
  start: Day;
  xp: number;
  activeDays: number;
  lessons: number;
  /** Cards answered in reviews. */
  reviews: number;
  minutes: number;
  /** First-try accuracy over the week, null without answers. */
  accuracy: number | null;
  /** XP of the week before, for a gentle comparison. */
  previousXp: number;
}

export interface WeekActivityRow {
  day: Day;
  xp: number;
  lessons: number;
  reviews: number;
  seconds: number;
}

export function summarizeWeek(
  start: Day,
  rows: readonly WeekActivityRow[],
  previousXp: number,
  answers: { n: number; correct: number },
): WeekSummary {
  const days = new Set(weekDays(start));
  const inWeek = rows.filter((r) => days.has(r.day));
  return {
    start,
    xp: inWeek.reduce((s, r) => s + r.xp, 0),
    activeDays: inWeek.filter((r) => r.xp > 0).length,
    lessons: inWeek.reduce((s, r) => s + r.lessons, 0),
    reviews: inWeek.reduce((s, r) => s + r.reviews, 0),
    minutes: Math.round(inWeek.reduce((s, r) => s + r.seconds, 0) / 60),
    accuracy: answers.n ? answers.correct / answers.n : null,
    previousXp,
  };
}

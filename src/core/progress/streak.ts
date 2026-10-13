/**
 * Day streak with free freezes. A day counts when the learner earned any XP. A missed day is
 * covered automatically by a freeze if one is available; freezes are earned every 7 streak days
 * (at most 2 in stock). Nothing here punishes: a broken streak simply starts again.
 */
import { addDays, daysBetween, type Day } from './dates';

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
export const START_FREEZES = 2;

/** Current streak: consecutive active or frozen days ending today, or yesterday if today is open. */
export function currentStreak(
  active: ReadonlySet<Day>,
  frozen: ReadonlySet<Day>,
  today: Day,
): number {
  const counts = (d: Day) => active.has(d) || frozen.has(d);
  let day = counts(today) ? today : addDays(today, -1);
  let n = 0;
  while (counts(day)) {
    // Frozen days keep the streak alive but do not add to it.
    if (active.has(day)) n++;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * Days to cover with freezes when the learner comes back: the days strictly between the last
 * counted day and yesterday that were missed. Returns [] when nothing was missed or when there are
 * not enough freezes (then the streak resets and the freezes are kept for next time).
 */
export function freezesNeeded(lastCounted: Day | null, today: Day, available: number): Day[] {
  if (!lastCounted) return [];
  const gap = daysBetween(lastCounted, today) - 1; // missed days before today
  if (gap <= 0 || gap > available) return [];
  return Array.from({ length: gap }, (_, i) => addDays(lastCounted, i + 1));
}

/** Freezes earned when the streak grew from `before` to `after` days. */
export function freezesEarned(before: number, after: number, stock: number): number {
  const milestones = Math.floor(after / FREEZE_EVERY) - Math.floor(before / FREEZE_EVERY);
  return Math.max(0, Math.min(milestones, MAX_FREEZES - stock));
}

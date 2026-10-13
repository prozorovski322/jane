/** Calendar days in the learner's local time zone, as "YYYY-MM-DD". */

export type Day = string;

export function dayOf(date: Date): Day {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Noon of the given day: safe against DST shifts when stepping by days. */
export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

export function addDays(day: Day, n: number): Day {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return dayOf(date);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

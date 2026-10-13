/** The learner's chosen daily study time, which sets the daily XP goal. */
import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';

const KEY_DAILY_MINUTES = 'goal.dailyMinutes';
export const MINUTE_OPTIONS = [5, 10, 15, 30] as const;

export async function dailyMinutes(db: Db): Promise<number> {
  return kvGet(db, KEY_DAILY_MINUTES, 10);
}

export async function setDailyMinutes(db: Db, minutes: number): Promise<void> {
  await kvSet(db, KEY_DAILY_MINUTES, minutes);
}

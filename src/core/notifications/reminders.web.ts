/**
 * The website has no study reminders. This version keeps expo-notifications out of the site
 * entirely: merely loading that module prints a warning in the browser console.
 */
import type { Db } from '@/core/storage/db';

export function configureNotifications() {}

export async function syncReminders(_db: Db, _now = new Date()): Promise<number> {
  return 0;
}

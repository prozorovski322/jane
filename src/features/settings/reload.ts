import { syncReminders } from '@/core/notifications/reminders';
import { getDb } from '@/core/storage';

import { useOnboarding } from '../onboarding/store';
import { useProgress } from '../progress/store';
import { loadSettings } from './store';

/** Reloads everything read from the database: after importing a copy, wiping, or syncing. */
export async function reloadAll() {
  const db = getDb();
  await loadSettings(db);
  await useOnboarding.getState().load(db);
  await useProgress.getState().refresh(db);
  void syncReminders(db);
}

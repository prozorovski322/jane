/**
 * Schedules the learner's study reminders as local notifications (nothing leaves the device).
 * Called at app start, after every session and whenever the reminder settings change.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dayOf } from '@/core/progress/dates';
import type { Db } from '@/core/storage/db';
import { kvGet } from '@/core/storage/kv';
import { DEFAULT_REMINDER, REMINDER_KEY, type ReminderPrefs } from '@/features/onboarding/store';

import { planReminders } from './plan';

const CHANNEL = 'reminders';

/** How the app behaves when a reminder arrives while it is open: show it quietly. */
export function configureNotifications() {
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Notifications are not available in this environment.
  }
}

/**
 * Replaces all scheduled reminders with the plan for the coming days. Returns how many were
 * scheduled (0 when reminders are off, not permitted or unavailable).
 */
export async function syncReminders(db: Db, now = new Date()): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const prefs = await kvGet<ReminderPrefs>(db, REMINDER_KEY, DEFAULT_REMINDER);
    if (!prefs.enabled) return 0;
    if (!(await Notifications.getPermissionsAsync()).granted) return 0;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Напоминания об уроках',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const active = await db.get<{ xp: number }>('SELECT xp FROM daily_activity WHERE day = ?', [
      dayOf(now),
    ]);
    const plan = planReminders({
      now,
      hour: prefs.hour,
      minute: prefs.minute,
      todayActive: (active?.xp ?? 0) > 0,
    });
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Jane', body: r.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: CHANNEL,
        },
      });
    }
    return plan.length;
  } catch {
    return 0;
  }
}

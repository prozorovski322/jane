/**
 * When and what to remind. Reminders are individual notifications for the next days rather than
 * one repeating alarm, so the app can leave out today's reminder once the learner has already
 * studied. The wording is friendly and never mentions losing a streak.
 */
import { hashString } from '@/lib/random';

export interface ReminderPlanInput {
  now: Date;
  hour: number;
  minute: number;
  /** The learner has already studied today: no reminder for today. */
  todayActive: boolean;
  /** How many days ahead to schedule. */
  days?: number;
}

export const REMINDER_TEXTS = [
  'Пара минут английского? Урок уже ждёт.',
  'Небольшое занятие сейчас — и день удался.',
  'Загляните в Jane: несколько слов на сегодня.',
  'Время для английского. Хватит и пяти минут.',
  'Повторим слова? Это быстро.',
  'Короткий урок поможет закрепить вчерашнее.',
  'Английский любит регулярность. Пара заданий?',
] as const;

export interface PlannedReminder {
  at: Date;
  body: string;
}

export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  const { now, hour, minute, todayActive, days = 7 } = input;
  const out: PlannedReminder[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue; // the time has passed
    if (i === 0 && todayActive) continue;
    const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
    out.push({ at, body: REMINDER_TEXTS[hashString(key) % REMINDER_TEXTS.length]! });
  }
  return out;
}

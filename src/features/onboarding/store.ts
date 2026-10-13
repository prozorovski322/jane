/** What the learner told us in onboarding, and whether it is finished. Stored in `kv`. */
import { create } from 'zustand';

import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';

import type { SelfLevel } from '../placement/engine';

export const GOALS = {
  travel: 'Путешествия',
  work: 'Работа и карьера',
  study: 'Учёба и экзамены',
  people: 'Общение и друзья',
  media: 'Фильмы, книги, игры',
  self: 'Для себя',
} as const;
export type Goal = keyof typeof GOALS;

export interface OnboardingData {
  done: boolean;
  goal: Goal | null;
  selfLevel: SelfLevel | null;
  completedAt: number | null;
}

const EMPTY: OnboardingData = { done: false, goal: null, selfLevel: null, completedAt: null };
const KEY = 'onboarding';

/** Reminder preferences chosen in onboarding; scheduling arrives with the Settings screen. */
export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}
export const REMINDER_KEY = 'reminders';
export const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, hour: 19, minute: 0 };

interface OnboardingStore {
  /** null until loaded from the database. */
  data: OnboardingData | null;
  load: (db: Db) => Promise<void>;
  save: (db: Db, patch: Partial<OnboardingData>) => Promise<void>;
}

export const useOnboarding = create<OnboardingStore>((set, get) => ({
  data: null,
  load: async (db) =>
    set({ data: { ...EMPTY, ...(await kvGet<Partial<OnboardingData>>(db, KEY, {})) } }),
  save: async (db, patch) => {
    const data = { ...(get().data ?? EMPTY), ...patch };
    await kvSet(db, KEY, data);
    set({ data });
  },
}));

export async function saveReminderPrefs(db: Db, prefs: Partial<ReminderPrefs>): Promise<void> {
  const current = await kvGet<ReminderPrefs>(db, REMINDER_KEY, DEFAULT_REMINDER);
  await kvSet(db, REMINDER_KEY, { ...current, ...prefs });
}

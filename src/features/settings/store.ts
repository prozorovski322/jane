/**
 * User preferences, persisted in the database (`kv` table, key "settings"). The Settings screen
 * arrives in stage 8; the store is used everywhere already.
 */
import { create } from 'zustand';

import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';
import type { SchemePreference } from '@/ui/theme/ThemeProvider';

export interface Settings {
  theme: SchemePreference;
  haptics: boolean;
  sounds: boolean;
  /** Speech rate for the normal speed; the slow button uses 60% of it. */
  speechRate: number;
  /** Preferred TTS voice identifier, or null for the automatic choice. */
  voice: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  haptics: true,
  sounds: true,
  speechRate: 0.9,
  voice: null,
};

const KEY = 'settings';

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  update: (patch) => set(patch),
}));

function current(): Settings {
  const { theme, haptics, sounds, speechRate, voice } = useSettings.getState();
  return { theme, haptics, sounds, speechRate, voice };
}

/** Loads saved settings and keeps saving every change. Returns an unsubscribe function. */
export async function bindSettings(db: Db): Promise<() => void> {
  const saved = await kvGet<Partial<Settings>>(db, KEY, {});
  // Unknown or missing keys fall back to defaults, so old saves keep working after updates.
  const merged = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (k in saved && typeof saved[k] === typeof DEFAULT_SETTINGS[k])
      (merged as Record<string, unknown>)[k] = saved[k];
    if (k === 'voice' && typeof saved.voice === 'string') merged.voice = saved.voice;
  }
  useSettings.setState(merged);
  return useSettings.subscribe(() => {
    void kvSet(db, KEY, current());
  });
}

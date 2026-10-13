/**
 * User preferences. In-memory for now; persisted to SQLite in stage 4 and editable on the
 * Settings screen in stage 8.
 */
import { create } from 'zustand';

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

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  update: (patch) => set(patch),
}));

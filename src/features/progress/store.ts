/**
 * Progress shown across the app (XP, streak, goal, completed lessons, due reviews), loaded from
 * the database and refreshed after every session.
 */
import { create } from 'zustand';

import { syncReminders } from '@/core/notifications/reminders';
import { countDue } from '@/core/storage/srs-repo';
import type { Db } from '@/core/storage/db';

import type { LessonSummary } from '../lesson/engine';
import {
  loadProgress,
  recordSession,
  type CompletionInfo,
  type ProgressSnapshot,
  type SessionMeta,
} from './service';

interface ProgressStore {
  snapshot: ProgressSnapshot | null;
  dueCount: number;
  /** Bumped on every refresh; screens reload their own queries when it changes. */
  version: number;
  /** Signals that data changed outside a session (dictionary edits, imports). */
  touch: () => void;
  refresh: (db: Db, now?: Date) => Promise<void>;
  record: (db: Db, meta: SessionMeta, summary: LessonSummary) => Promise<CompletionInfo>;
}

export const useProgress = create<ProgressStore>((set, get) => ({
  snapshot: null,
  dueCount: 0,
  version: 0,
  touch: () => set((s) => ({ version: s.version + 1 })),
  refresh: async (db, now = new Date()) => {
    const [snapshot, dueCount] = await Promise.all([loadProgress(db, now), countDue(db, now)]);
    set((s) => ({ snapshot, dueCount, version: s.version + 1 }));
  },
  record: async (db, meta, summary) => {
    const info = await recordSession(db, meta, summary);
    await get().refresh(db);
    // Studying today means today's reminder is no longer needed.
    void syncReminders(db);
    return info;
  },
}));

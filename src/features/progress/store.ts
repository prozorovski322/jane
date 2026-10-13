/**
 * Progress shown across the app (XP, streak, goal, completed lessons, due reviews), loaded from
 * the database and refreshed after every session.
 */
import { create } from 'zustand';

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
  refresh: (db: Db, now?: Date) => Promise<void>;
  record: (db: Db, meta: SessionMeta, summary: LessonSummary) => Promise<CompletionInfo>;
}

export const useProgress = create<ProgressStore>((set, get) => ({
  snapshot: null,
  dueCount: 0,
  refresh: async (db, now = new Date()) => {
    const [snapshot, dueCount] = await Promise.all([loadProgress(db, now), countDue(db, now)]);
    set({ snapshot, dueCount });
  },
  record: async (db, meta, summary) => {
    const info = await recordSession(db, meta, summary);
    await get().refresh(db);
    return info;
  },
}));

/**
 * The learner's account: whether they are signed in, their profile, and sync. Accounts are off
 * when Supabase is not configured (status "off"): then nothing here talks to a server.
 *
 * Sync runs after signing in, at start-up, and a few seconds after progress changes; its result
 * is merged into the local database, which is then reloaded.
 */
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/core/account/client';
import { accountsEnabled } from '@/core/account/config';
import { getDb } from '@/core/storage';

import { useProgress } from '../progress/store';
import { reloadAll } from '../settings/reload';
import { loadProfile, syncProgress, type Profile } from './service';

export type AccountStatus = 'off' | 'loading' | 'signed-out' | 'signed-in';

interface AccountStore {
  status: AccountStatus;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  syncing: boolean;
  lastSyncedAt: number | null;
  syncError: boolean;
  /** Arrived by a password-reset link: the new-password screen should be shown. */
  recovering: boolean;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sync: () => Promise<void>;
  /** Sync a little later; repeated calls in a row run it once. */
  syncSoon: () => void;
  setRecovering: (v: boolean) => void;
}

const SYNC_DELAY_MS = 3000;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

export const useAccount = create<AccountStore>((set, get) => {
  const apply = (session: Session | null) => {
    const user = session?.user ?? null;
    const changedUser = user?.id !== get().userId;
    set({
      status: user ? 'signed-in' : 'signed-out',
      userId: user?.id ?? null,
      email: user?.email ?? null,
      ...(changedUser ? { profile: null, lastSyncedAt: null } : {}),
    });
    if (user && changedUser) {
      void get().refreshProfile();
      void get().sync();
    }
  };

  return {
    status: accountsEnabled() ? 'loading' : 'off',
    userId: null,
    email: null,
    profile: null,
    syncing: false,
    lastSyncedAt: null,
    syncError: false,
    recovering: false,

    init: async () => {
      if (!accountsEnabled() || started) return;
      started = true;
      const sb = supabase();
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') set({ recovering: true });
        apply(session);
      });
      const { data } = await sb.auth.getSession();
      apply(data.session);
      // Progress changed (a lesson, a dictionary edit): send it to the account soon after.
      useProgress.subscribe((s, prev) => {
        if (s.version !== prev.version && !get().syncing) get().syncSoon();
      });
    },

    refreshProfile: async () => {
      const id = get().userId;
      if (!id) return;
      try {
        set({ profile: await loadProfile(id) });
      } catch {
        // Offline: the profile shows up on the next attempt.
      }
    },

    sync: async () => {
      const id = get().userId;
      if (!id || get().syncing) return;
      set({ syncing: true });
      try {
        const db = getDb();
        const streak = useProgress.getState().snapshot?.streak ?? 0;
        const result = await syncProgress(db, id, streak);
        if (result === 'merged') await reloadAll();
        set({ lastSyncedAt: Date.now(), syncError: false });
      } catch {
        set({ syncError: true });
      } finally {
        set({ syncing: false });
      }
    },

    syncSoon: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void get().sync(), SYNC_DELAY_MS);
    },

    setRecovering: (recovering) => set({ recovering }),
  };
});

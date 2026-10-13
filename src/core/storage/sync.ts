/**
 * Synchronization boundary. Today the app is local-only; an account/cloud provider (and a social
 * layer on top of it) can implement this interface later without touching features: they read
 * and write the local database, and the provider exchanges snapshots with a server.
 */
import type { Snapshot } from './backup';

export interface SyncStatus {
  /** Signed in to a remote account. */
  connected: boolean;
  lastSyncedAt: string | null;
}

export interface SyncProvider {
  readonly id: string;
  status(): Promise<SyncStatus>;
  /**
   * Sends the local snapshot and returns the merged snapshot to apply locally. A provider must
   * never drop local progress: merge conflicts resolve towards more progress.
   */
  sync(local: Snapshot): Promise<Snapshot>;
}

/** The default provider: everything stays on the device. */
export const localSyncProvider: SyncProvider = {
  id: 'local',
  status: async () => ({ connected: false, lastSyncedAt: null }),
  sync: async (local) => local,
};

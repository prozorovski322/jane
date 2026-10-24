/**
 * The app's database: opened and migrated once at startup, then shared.
 */
import type { Db } from './db';
import { openExpoDb } from './expo-db';
import { migrate } from './migrations';

let db: Db | null = null;
let opening: Promise<Db> | null = null;

export function initDatabase(open: () => Promise<Db> = openExpoDb): Promise<Db> {
  opening ??= (async () => {
    const d = await open();
    try {
      await migrate(d);
    } catch (error) {
      await d.close().catch(() => {});
      throw error;
    }
    db = d;
    return d;
  })().catch((e: unknown) => {
    opening = null;
    throw e;
  });
  return opening;
}

export function getDb(): Db {
  if (!db) throw new Error('Database is not initialized; call initDatabase() first');
  return db;
}

/** For tests: use an already opened database. */
export function setDb(d: Db | null) {
  db = d;
  opening = d ? Promise.resolve(d) : null;
}

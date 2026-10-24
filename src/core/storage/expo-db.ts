import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { createTransactionLock, type Db } from './db';
import { acquireWebDatabaseLease } from './web-db-lock';

export async function openExpoDb(name = 'jane.db'): Promise<Db> {
  const release = Platform.OS === 'web' ? await acquireWebDatabaseLease() : () => {};
  let db: SQLite.SQLiteDatabase;
  try {
    db = await SQLite.openDatabaseAsync(name);
    try {
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    } catch (error) {
      await db.closeAsync().catch(() => {});
      throw error;
    }
  } catch (error) {
    release();
    throw error;
  }
  const lock = createTransactionLock();

  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      const r = await db.runAsync(sql, [...params]);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: (sql, params = []) => db.getAllAsync(sql, [...params]),
    get: (sql, params = []) => db.getFirstAsync(sql, [...params]),
    transaction: (fn) =>
      lock(async () => {
        // withExclusiveTransactionAsync is not available on web; the lock keeps our own
        // transactions from interleaving.
        let result!: Awaited<ReturnType<typeof fn>>;
        await db.withTransactionAsync(async () => {
          result = await fn();
        });
        return result;
      }),
    close: async () => {
      try {
        await db.closeAsync();
      } finally {
        release();
      }
    },
  };
}

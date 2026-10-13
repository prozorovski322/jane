import * as SQLite from 'expo-sqlite';

import { createTransactionLock, type Db } from './db';

export async function openExpoDb(name = 'jane.db'): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
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
    close: () => db.closeAsync(),
  };
}

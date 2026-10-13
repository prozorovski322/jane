/**
 * Test-only Db on Node's built-in SQLite (`node:sqlite`, Node 22.13+). Never imported by the app.
 */
import { createTransactionLock, type Db, type SqlValue } from './db';

interface NodeStatement {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
}
interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}

export function openNodeDb(path = ':memory:'): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => NodeDatabase;
  };
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  const lock = createTransactionLock();
  // node:sqlite returns rows with a null prototype; tests compare them with plain objects.
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);

  return {
    exec: async (sql) => db.exec(sql),
    run: async (sql, params = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      db
        .prepare(sql)
        .all(...params)
        .map((r) => plain<T>(r)!),
    get: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      plain<T>(db.prepare(sql).get(...params)),
    transaction: (fn) =>
      lock(async () => {
        db.exec('BEGIN');
        try {
          const result = await fn();
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      }),
    close: async () => db.close(),
  };
}

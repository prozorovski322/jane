/**
 * The minimal database interface the app uses. Two implementations: expo-sqlite in the app
 * (`expo-db.ts`) and Node's built-in SQLite in tests (`node-db.ts`), so repositories and
 * migrations are tested against a real SQLite engine.
 */

export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  /** Runs one or more statements without parameters (schema, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /** Runs `fn` in a transaction: all its writes are committed together or not at all. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Serializes transactions: a second one waits for the first instead of nesting into it. */
export function createTransactionLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return function locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

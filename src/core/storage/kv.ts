/** Small typed key-value store for settings and counters, stored as JSON. */
import type { Db } from './db';

export async function kvGet<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function kvSet(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

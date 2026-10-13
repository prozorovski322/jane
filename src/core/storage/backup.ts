/**
 * Full snapshot of the learner's data as JSON: used for export/import in Settings and as the
 * unit of exchange for a future sync provider. Import validates everything before touching the
 * database and replaces the data in one transaction.
 */
import { z } from 'zod';

import type { Db, SqlValue } from './db';
import { SCHEMA_VERSION } from './migrations';

/** Tables in dependency order (parents before children). */
export const BACKUP_TABLES = [
  'kv',
  'lesson_results',
  'attempts',
  'lesson_progress',
  'daily_activity',
  'streak_freezes',
  'srs_cards',
  'srs_log',
  'favorites',
  'user_words',
] as const;

const Row = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

export const Snapshot = z.strictObject({
  app: z.literal('jane'),
  schema: z.number().int().min(1),
  exportedAt: z.string(),
  // Tables added by later schema versions are missing from older backups: default to empty.
  tables: z.strictObject(
    Object.fromEntries(BACKUP_TABLES.map((t) => [t, z.array(Row).default([])])) as Record<
      (typeof BACKUP_TABLES)[number],
      z.ZodDefault<z.ZodArray<typeof Row>>
    >,
  ),
});
export type Snapshot = z.infer<typeof Snapshot>;

export async function exportSnapshot(db: Db, now = new Date()): Promise<Snapshot> {
  const tables = {} as Snapshot['tables'];
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}`);
  }
  return { app: 'jane', schema: SCHEMA_VERSION, exportedAt: now.toISOString(), tables };
}

export class BackupError extends Error {}

/** Parses a backup file; throws BackupError with a message for the learner. */
export function parseSnapshot(json: string): Snapshot {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupError('Файл не похож на резервную копию Jane: это не JSON.');
  }
  const r = Snapshot.safeParse(data);
  if (!r.success) throw new BackupError('Файл не похож на резервную копию Jane или повреждён.');
  if (r.data.schema > SCHEMA_VERSION) {
    throw new BackupError(
      'Копия сделана в более новой версии приложения. Обновите Jane и попробуйте снова.',
    );
  }
  return r.data;
}

/** Replaces all learner data with the snapshot. */
export async function importSnapshot(db: Db, snap: Snapshot): Promise<void> {
  await db.transaction(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) await db.run(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      for (const row of snap.tables[t]) {
        const cols = Object.keys(row);
        if (!cols.every((c) => /^[a-z_]+$/.test(c)))
          throw new BackupError(`Неверное поле в таблице ${t}.`);
        await db.run(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] ?? null),
        );
      }
    }
  });
}

/** Deletes all learner data (Settings → «Удалить данные»). */
export async function wipeData(db: Db): Promise<void> {
  await db.transaction(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) await db.run(`DELETE FROM ${t}`);
  });
}

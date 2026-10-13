/**
 * Schema migrations, applied in order by `PRAGMA user_version`. Never edit a released migration:
 * add a new one. Times are milliseconds since the epoch; `day` is the learner's local date
 * ("YYYY-MM-DD"), so streaks follow the learner's calendar, not UTC.
 */
import type { Db } from './db';

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE lesson_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        unit_id TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('lesson', 'test', 'review', 'practice')),
        started_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        day TEXT NOT NULL,
        total INTEGER NOT NULL,
        answered INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        score REAL NOT NULL,
        xp INTEGER NOT NULL,
        passed INTEGER NOT NULL
      );
      CREATE INDEX lesson_results_lesson ON lesson_results (lesson_id);
      CREATE INDEX lesson_results_day ON lesson_results (day);

      CREATE TABLE attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id INTEGER NOT NULL REFERENCES lesson_results (id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        correct INTEGER NOT NULL,
        score REAL NOT NULL,
        used_hint INTEGER NOT NULL,
        words TEXT NOT NULL,
        grammar TEXT NOT NULL,
        troubles TEXT NOT NULL,
        at INTEGER NOT NULL
      );
      CREATE INDEX attempts_at ON attempts (at);

      CREATE TABLE lesson_progress (
        lesson_id TEXT PRIMARY KEY NOT NULL,
        unit_id TEXT NOT NULL,
        first_completed_at INTEGER NOT NULL,
        last_completed_at INTEGER NOT NULL,
        best_score REAL NOT NULL,
        passed INTEGER NOT NULL,
        times INTEGER NOT NULL
      );

      CREATE TABLE daily_activity (
        day TEXT PRIMARY KEY NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        lessons INTEGER NOT NULL DEFAULT 0,
        reviews INTEGER NOT NULL DEFAULT 0,
        seconds INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE streak_freezes (
        day TEXT PRIMARY KEY NOT NULL,
        used_at INTEGER NOT NULL
      );

      CREATE TABLE srs_cards (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('word', 'grammar')),
        ref TEXT NOT NULL,
        due INTEGER NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        learning_steps INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state INTEGER NOT NULL,
        last_review INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX srs_cards_due ON srs_cards (due);

      CREATE TABLE srs_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL REFERENCES srs_cards (id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        state INTEGER NOT NULL,
        due INTEGER NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reviewed_at INTEGER NOT NULL
      );
      CREATE INDEX srs_log_card ON srs_log (card_id);
    `,
  },
  {
    version: 2,
    sql: `
      -- Dictionary: favorite words (course or own) and the learner's own words.
      CREATE TABLE favorites (
        word_id TEXT PRIMARY KEY NOT NULL,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE user_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        en TEXT NOT NULL,
        ru TEXT NOT NULL,
        example_en TEXT,
        example_ru TEXT,
        note TEXT,
        created_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 3,
    sql: `
      -- Lessons credited by the placement test rather than completed: 'lesson' | 'placement'.
      ALTER TABLE lesson_progress ADD COLUMN source TEXT NOT NULL DEFAULT 'lesson';
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export async function schemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Applies pending migrations; each one in its own transaction. Returns the new version. */
export async function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  let current = await schemaVersion(db);
  const latest = migrations[migrations.length - 1]?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `Database schema ${current} is newer than this app (${latest}); update the app.`,
    );
  }
  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      await db.exec(m.sql);
      await db.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}

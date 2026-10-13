import type { ReviewLog } from 'ts-fsrs';

import type { SrsCard } from '../srs/scheduler';
import type { Db } from './db';

interface CardRow {
  id: string;
  kind: SrsCard['kind'];
  ref: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
  created_at: number;
}

function fromRow(r: CardRow): SrsCard {
  return {
    id: r.id,
    kind: r.kind,
    ref: r.ref,
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review === null ? undefined : new Date(r.last_review),
    createdAt: r.created_at,
  };
}

export async function getCards(db: Db, ids: readonly string[]): Promise<Map<string, SrsCard>> {
  const out = new Map<string, SrsCard>();
  // SQLite limits bound parameters; 500 per query is safely below every platform's limit.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = await db.all<CardRow>(
      `SELECT * FROM srs_cards WHERE id IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    );
    for (const r of rows) out.set(r.id, fromRow(r));
  }
  return out;
}

export async function saveCard(db: Db, c: SrsCard): Promise<void> {
  await db.run(
    `INSERT INTO srs_cards (id, kind, ref, due, stability, difficulty, elapsed_days, scheduled_days,
       learning_steps, reps, lapses, state, last_review, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
       elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
       learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
       state = excluded.state, last_review = excluded.last_review`,
    [
      c.id,
      c.kind,
      c.ref,
      c.due.getTime(),
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.state,
      c.last_review ? c.last_review.getTime() : null,
      c.createdAt,
    ],
  );
}

export async function logReview(db: Db, cardId: string, log: ReviewLog): Promise<void> {
  await db.run(
    `INSERT INTO srs_log (card_id, rating, state, due, stability, difficulty, scheduled_days, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cardId,
      log.rating,
      log.state,
      new Date(log.due).getTime(),
      log.stability,
      log.difficulty,
      log.scheduled_days,
      new Date(log.review).getTime(),
    ],
  );
}

/** Cards due by `now`, most overdue first. */
export async function dueCards(db: Db, now: Date, limit = 50): Promise<SrsCard[]> {
  const rows = await db.all<CardRow>(
    'SELECT * FROM srs_cards WHERE due <= ? ORDER BY due LIMIT ?',
    [now.getTime(), limit],
  );
  return rows.map(fromRow);
}

export async function countDue(db: Db, now: Date): Promise<number> {
  const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM srs_cards WHERE due <= ?', [
    now.getTime(),
  ]);
  return row?.n ?? 0;
}

/** All cards of one kind; the word list is at most a few thousand rows. */
export async function allCards(db: Db, kind?: SrsCard['kind']): Promise<SrsCard[]> {
  const rows = kind
    ? await db.all<CardRow>('SELECT * FROM srs_cards WHERE kind = ?', [kind])
    : await db.all<CardRow>('SELECT * FROM srs_cards');
  return rows.map(fromRow);
}

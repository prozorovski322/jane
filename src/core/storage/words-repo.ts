/** Favorites and the learner's own dictionary words. */
import type { Db } from './db';

export interface UserWord {
  /** Word id used everywhere else (cards, favorites): "user-<n>". */
  id: string;
  en: string;
  ru: string[];
  example: { en: string; ru: string } | null;
  note: string | null;
  createdAt: number;
}

interface UserWordRow {
  id: number;
  en: string;
  ru: string;
  example_en: string | null;
  example_ru: string | null;
  note: string | null;
  created_at: number;
}

export const USER_WORD_PREFIX = 'user-';

export function isUserWordId(id: string): boolean {
  return id.startsWith(USER_WORD_PREFIX);
}

function fromRow(r: UserWordRow): UserWord {
  return {
    id: `${USER_WORD_PREFIX}${r.id}`,
    en: r.en,
    ru: JSON.parse(r.ru) as string[],
    example: r.example_en && r.example_ru ? { en: r.example_en, ru: r.example_ru } : null,
    note: r.note,
    createdAt: r.created_at,
  };
}

export async function listUserWords(db: Db): Promise<UserWord[]> {
  const rows = await db.all<UserWordRow>(
    'SELECT * FROM user_words ORDER BY created_at DESC, id DESC',
  );
  return rows.map(fromRow);
}

export interface NewUserWord {
  en: string;
  ru: string[];
  example?: { en: string; ru: string } | null;
  note?: string | null;
}

export async function addUserWord(db: Db, w: NewUserWord, now = new Date()): Promise<UserWord> {
  const r = await db.run(
    'INSERT INTO user_words (en, ru, example_en, example_ru, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      w.en.trim(),
      JSON.stringify(w.ru.map((s) => s.trim()).filter(Boolean)),
      w.example?.en ?? null,
      w.example?.ru ?? null,
      w.note ?? null,
      now.getTime(),
    ],
  );
  const row = await db.get<UserWordRow>('SELECT * FROM user_words WHERE id = ?', [
    r.lastInsertRowId,
  ]);
  return fromRow(row!);
}

/** Removes an own word with its favorite mark and its review card. */
export async function deleteUserWord(db: Db, id: string): Promise<void> {
  const n = Number(id.slice(USER_WORD_PREFIX.length));
  await db.transaction(async () => {
    await db.run('DELETE FROM user_words WHERE id = ?', [n]);
    await db.run('DELETE FROM favorites WHERE word_id = ?', [id]);
    await db.run('DELETE FROM srs_cards WHERE id = ?', [`word:${id}`]);
  });
}

export async function listFavorites(db: Db): Promise<Set<string>> {
  const rows = await db.all<{ word_id: string }>('SELECT word_id FROM favorites');
  return new Set(rows.map((r) => r.word_id));
}

export async function setFavorite(
  db: Db,
  wordId: string,
  on: boolean,
  now = new Date(),
): Promise<void> {
  if (on) {
    await db.run('INSERT OR IGNORE INTO favorites (word_id, added_at) VALUES (?, ?)', [
      wordId,
      now.getTime(),
    ]);
  } else {
    await db.run('DELETE FROM favorites WHERE word_id = ?', [wordId]);
  }
}

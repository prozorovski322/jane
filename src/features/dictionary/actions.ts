import { getLexicon } from '@/core/content';
import { newCard } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { getCards, saveCard } from '@/core/storage/srs-repo';
import {
  addUserWord,
  listUserWords,
  type NewUserWord,
  type UserWord,
} from '@/core/storage/words-repo';

import { normalizeQuery } from './search';

/** Puts a word into spaced repetition (due now) unless it is already there. */
export async function startLearning(db: Db, wordId: string, now = new Date()): Promise<void> {
  const id = `word:${wordId}`;
  if ((await getCards(db, [id])).has(id)) return;
  await saveCard(db, newCard('word', wordId, now));
}

const LATIN = /[A-Za-z]/;
const CYRILLIC = /[Ѐ-ӿ]/;

export interface WordDraft {
  en: string;
  ru: string;
  exampleEn: string;
  exampleRu: string;
  note: string;
}

export type DraftErrors = Partial<Record<keyof WordDraft, string>>;

export function validateDraft(d: WordDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.en.trim()) e.en = 'Напишите слово или фразу по-английски.';
  else if (!LATIN.test(d.en) || CYRILLIC.test(d.en))
    e.en = 'Здесь нужно английское слово латиницей.';
  if (!d.ru.trim()) e.ru = 'Добавьте хотя бы один перевод.';
  else if (!CYRILLIC.test(d.ru)) e.ru = 'Перевод — по-русски.';
  if (!!d.exampleEn.trim() !== !!d.exampleRu.trim()) {
    e.exampleRu = 'Пример нужен вместе с переводом — или оставьте оба поля пустыми.';
  }
  return e;
}

/** An existing word with the same spelling, in the course or among own words. */
export async function findDuplicate(
  db: Db,
  en: string,
): Promise<{ id: string; own: boolean } | null> {
  const key = normalizeQuery(en);
  for (const w of getLexicon().values())
    if (normalizeQuery(w.en) === key) return { id: w.id, own: false };
  for (const w of await listUserWords(db))
    if (normalizeQuery(w.en) === key) return { id: w.id, own: true };
  return null;
}

/** Saves an own word and starts learning it right away. */
export async function saveOwnWord(db: Db, d: WordDraft, now = new Date()): Promise<UserWord> {
  const word: NewUserWord = {
    en: d.en.trim(),
    ru: d.ru
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean),
    example: d.exampleEn.trim() ? { en: d.exampleEn.trim(), ru: d.exampleRu.trim() } : null,
    note: d.note.trim() || null,
  };
  const saved = await addUserWord(db, word, now);
  await startLearning(db, saved.id, now);
  return saved;
}

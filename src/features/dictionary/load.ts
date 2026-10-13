import { getLexicon } from '@/core/content';
import type { LexiconEntry } from '@/core/content/bundle-types';
import type { SrsCard } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { allCards } from '@/core/storage/srs-repo';
import { listFavorites, listUserWords } from '@/core/storage/words-repo';

import { asLexiconEntry, fromLexicon, fromUserWord, type DictEntry } from './entries';

export interface DictionaryData {
  /** Own words first, then the course lexicon in course order. */
  entries: DictEntry[];
  cards: Map<string, SrsCard>;
  favorites: Set<string>;
}

export async function loadDictionary(db: Db): Promise<DictionaryData> {
  const [own, cards, favorites] = await Promise.all([
    listUserWords(db),
    allCards(db, 'word'),
    listFavorites(db),
  ]);
  return {
    entries: [...own.map(fromUserWord), ...[...getLexicon().values()].map(fromLexicon)],
    cards: new Map(cards.map((c) => [c.id, c])),
    favorites,
  };
}

/** The learner's own words in the shape the review generator expects. */
export async function loadOwnLexicon(db: Db): Promise<LexiconEntry[]> {
  return (await listUserWords(db)).map((w) => asLexiconEntry(fromUserWord(w)));
}

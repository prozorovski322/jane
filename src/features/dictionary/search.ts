/**
 * Dictionary search and filters. Matches English and Russian, ignores case and ё, ranks exact
 * and prefix matches first, keeps course order otherwise.
 */
import type { Level } from '@/core/content/schema';
import { isMastered, type SrsCard } from '@/core/srs/scheduler';

import type { DictEntry } from './entries';

export type DictStatus = 'all' | 'learning' | 'known' | 'favorites' | 'mine';

export interface DictFilter {
  query: string;
  /** Empty means every level. */
  levels: readonly Level[];
  status: DictStatus;
}

export interface DictContext {
  cards: ReadonlyMap<string, SrsCard>;
  favorites: ReadonlySet<string>;
}

export type WordStatus = 'new' | 'learning' | 'known';

export function wordStatus(id: string, cards: ReadonlyMap<string, SrsCard>): WordStatus {
  const card = cards.get(`word:${id}`);
  if (!card) return 'new';
  return isMastered(card) ? 'known' : 'learning';
}

export function normalizeQuery(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Lower is better; Infinity means no match. */
function rank(e: DictEntry, q: string): number {
  const en = normalizeQuery(e.en);
  if (en === q) return 0;
  if (en.startsWith(q)) return 1;
  const ru = e.ru.map(normalizeQuery);
  if (ru.some((r) => r === q)) return 2;
  if (ru.some((r) => r.startsWith(q))) return 3;
  if (en.split(/[\s-]/).some((w) => w.startsWith(q))) return 4;
  if (ru.some((r) => r.split(/[\s,()]+/).some((w) => w.startsWith(q)))) return 5;
  if (en.includes(q) || ru.some((r) => r.includes(q))) return 6;
  return Infinity;
}

export function searchDictionary(
  entries: readonly DictEntry[],
  f: DictFilter,
  ctx: DictContext,
): DictEntry[] {
  const q = normalizeQuery(f.query);
  const levels = new Set(f.levels);
  const passes = (e: DictEntry) => {
    if (levels.size && !(e.level && levels.has(e.level))) return false;
    switch (f.status) {
      case 'all':
        return true;
      case 'favorites':
        return ctx.favorites.has(e.id);
      case 'mine':
        return e.own;
      case 'learning':
        return wordStatus(e.id, ctx.cards) === 'learning';
      case 'known':
        return wordStatus(e.id, ctx.cards) === 'known';
    }
  };
  const scored = entries
    .map((e, i) => ({ e, i, r: q ? rank(e, q) : 0 }))
    .filter((x) => x.r !== Infinity && passes(x.e));
  scored.sort((a, b) => a.r - b.r || a.i - b.i);
  return scored.map((x) => x.e);
}

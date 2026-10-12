import { normalizeAnswer } from './normalize';

/** Splits a sentence into word tiles; sentence punctuation is not a tile. */
export function splitTiles(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((t) => t.replace(/^[«"“(]+|[.,!?;:»"”)…]+$/g, ''))
    .filter(Boolean);
}

/** Order-insensitive key of a tile multiset, used to check that variants use the same tiles. */
export function tileMultisetKey(tiles: readonly string[]): string {
  return tiles
    .map((t) => normalizeAnswer(t))
    .sort()
    .join('|');
}

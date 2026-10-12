/**
 * Pattern matching for free answers (speaking and writing). Content authors write patterns as
 * case-insensitive regular expressions; apostrophes and whitespace are normalized on both sides.
 */
import { normalizeApostrophes } from '../content/lexical';

const cache = new Map<string, RegExp>();

export function compilePattern(pattern: string): RegExp {
  let re = cache.get(pattern);
  if (!re) {
    re = new RegExp(normalizeApostrophes(pattern), 'iu');
    cache.set(pattern, re);
  }
  return re;
}

export function normalizeFreeText(text: string): string {
  return normalizeApostrophes(text).replace(/\s+/g, ' ').trim();
}

export function matchesAny(text: string, patterns: readonly string[]): boolean {
  const t = normalizeFreeText(text);
  return patterns.some((p) => compilePattern(p).test(t));
}

/** Number of keyword groups present in the text. */
export function countKeywordGroups(text: string, groups: readonly (readonly string[])[]): number {
  return groups.filter((g) => matchesAny(text, g)).length;
}

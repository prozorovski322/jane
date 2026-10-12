import { normalizeApostrophes } from '../content/lexical';

/**
 * Canonical form for comparing short answers: lowercase, unified apostrophes and dashes,
 * no sentence punctuation, single spaces. Russian "ё" is folded into "е".
 */
export function normalizeAnswer(s: string): string {
  return normalizeApostrophes(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[.,!?;:"«»“”()…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

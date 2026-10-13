/**
 * Soft checking of typed answers: alternatives, contractions, and small typos.
 *
 * A typo is accepted only inside a word long enough to have one (4+ letters for one edit,
 * 8+ for two) and only when the typed word is not another real word: "their" for "there" is
 * a mistake, "teachr" for "teacher" is a typo. Missing or extra words are never typos.
 */
import { editDistance } from './distance';
import { canonicalTokens, type AnswerLang } from './normalize';

export interface Typo {
  typed: string;
  expected: string;
}

export type TypedMatch =
  | { verdict: 'correct'; matched: string }
  | { verdict: 'typo'; matched: string; typos: Typo[] }
  | { verdict: 'wrong' };

export interface TypedOptions {
  lang: AnswerLang;
  /** True when `word` is a real word of the language (e.g. in the course lexicon). */
  isWord?: (word: string) => boolean;
}

function allowedEdits(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

function typosBetween(
  input: string[],
  expected: string[],
  isWord?: (w: string) => boolean,
): Typo[] | null {
  if (input.length !== expected.length) {
    // Only a different split of the same letters ("good bye" / "goodbye") is forgiven.
    return input.join('') === expected.join('')
      ? [{ typed: input.join(' '), expected: expected.join(' ') }]
      : null;
  }
  const typos: Typo[] = [];
  for (let i = 0; i < input.length; i++) {
    const typed = input[i]!;
    const exp = expected[i]!;
    if (typed === exp) continue;
    if (isWord?.(typed)) return null;
    if (editDistance(typed, exp) > allowedEdits(exp)) return null;
    typos.push({ typed, expected: exp });
  }
  return typos;
}

export function matchTyped(
  input: string,
  accepted: readonly string[],
  opts: TypedOptions,
): TypedMatch {
  const tokens = canonicalTokens(input, opts.lang);
  if (!tokens.length) return { verdict: 'wrong' };

  let best: { matched: string; typos: Typo[] } | null = null;
  for (const answer of accepted) {
    const expected = canonicalTokens(answer, opts.lang);
    const typos = typosBetween(tokens, expected, opts.isWord);
    if (!typos) continue;
    if (!typos.length) return { verdict: 'correct', matched: answer };
    if (!best || typos.length < best.typos.length) best = { matched: answer, typos };
  }
  if (best) {
    const words = canonicalTokens(best.matched, opts.lang).length;
    if (best.typos.length <= Math.max(1, Math.floor(words / 3))) {
      return { verdict: 'typo', matched: best.matched, typos: best.typos };
    }
  }
  return { verdict: 'wrong' };
}

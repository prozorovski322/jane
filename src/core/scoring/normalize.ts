import { normalizeApostrophes } from '../content/lexical';

export type AnswerLang = 'en' | 'ru';

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

/** "'s" means "is" only after these words; elsewhere it is a possessive and stays as written. */
const S_IS = new Set([
  'he',
  'she',
  'it',
  'that',
  'what',
  'where',
  'who',
  'how',
  'there',
  'here',
  'this',
]);

const WHOLE: Record<string, string> = {
  "won't": 'will not',
  "can't": 'can not',
  cannot: 'can not',
  "shan't": 'shall not',
  "let's": 'let us',
};

const SUFFIXES: [string, string][] = [
  ["n't", ' not'],
  ["'re", ' are'],
  ["'ve", ' have'],
  ["'ll", ' will'],
  ["'m", ' am'],
  ["'d", ' would'],
];

function expandToken(t: string): string {
  const whole = WHOLE[t];
  if (whole) return whole;
  for (const [suffix, full] of SUFFIXES) {
    if (t.length > suffix.length && t.endsWith(suffix)) return t.slice(0, -suffix.length) + full;
  }
  if (t.endsWith("'s") && S_IS.has(t.slice(0, -2))) return t.slice(0, -2) + ' is';
  return t;
}

/**
 * Tokens of an answer in canonical form. English contractions are expanded, so "I'm" and
 * "I am" compare equal; both sides of a comparison go through the same function.
 */
export function canonicalTokens(s: string, lang: AnswerLang): string[] {
  const norm = normalizeAnswer(s);
  if (!norm) return [];
  const tokens = norm.split(' ');
  if (lang === 'ru') return tokens;
  return tokens.flatMap((t) => expandToken(t).split(' '));
}

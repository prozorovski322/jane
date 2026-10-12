/**
 * Lightweight English tokenization and lemmatization.
 *
 * Used by the content checker to verify that texts stay within the learner's vocabulary, and by
 * the app to look words up in the dictionary. It does not try to be a full morphological
 * analyzer: it produces candidate base forms and lets the caller check them against a word list.
 */

export interface Token {
  /** The token as written, without surrounding punctuation. */
  raw: string;
  /** Lowercased form with typographic apostrophes normalized. */
  lower: string;
  /** True when the token starts a sentence (first token or after . ! ? :). */
  sentenceStart: boolean;
}

const CONTRACTIONS: Record<string, string[]> = {
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  "shan't": ['shall', 'not'],
  "ain't": ['be', 'not'],
  "let's": ['let', 'us'],
};

const CLITICS: [suffix: string, expansion: string[]][] = [
  ["n't", ['not']],
  ["'re", ['are']],
  ["'ve", ['have']],
  ["'ll", ['will']],
  ["'m", ['am']],
  ["'d", ['would']],
  // "'s" is "is", "has" or possessive; the base word is what matters for vocabulary.
  ["'s", []],
  ["s'", []],
];

export function normalizeApostrophes(s: string): string {
  return s.replace(/[‘’ʼ`]/g, "'");
}

/** Splits English text into word tokens; punctuation is dropped, sentence starts are marked. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-z]+(?:'[A-Za-z]+)*'?|[0-9]+(?:[.:,][0-9]+)*|[.!?:;]/g;
  let sentenceStart = true;
  for (const m of normalizeApostrophes(text).matchAll(re)) {
    const raw = m[0];
    if (/^[.!?:;]$/.test(raw)) {
      if (raw !== ';') sentenceStart = true;
      continue;
    }
    tokens.push({ raw, lower: raw.toLowerCase(), sentenceStart });
    sentenceStart = false;
  }
  return tokens;
}

/** Expands contractions: "don't" → ["do", "not"], "I'm" → ["i", "am"], "Anna's" → ["anna"]. */
export function expandContraction(lower: string): string[] {
  const whole = CONTRACTIONS[lower];
  if (whole) return whole;
  for (const [suffix, expansion] of CLITICS) {
    if (lower.length > suffix.length && lower.endsWith(suffix)) {
      return [lower.slice(0, -suffix.length), ...expansion];
    }
  }
  return [lower];
}

/** Present-tense forms of the most irregular verbs; past forms come from the irregular verb list. */
const IRREGULAR_PRESENT: Record<string, string> = {
  am: 'be',
  is: 'be',
  are: 'be',
  has: 'have',
  does: 'do',
};

const VOWELS = /[aeiou]/;

function undouble(stem: string): string | null {
  const n = stem.length;
  if (n >= 3 && stem[n - 1] === stem[n - 2] && !VOWELS.test(stem[n - 1]!) && stem[n - 1] !== 's') {
    return stem.slice(0, -1);
  }
  return null;
}

/**
 * Candidate base forms for an inflected word, most likely first. Always includes the word itself.
 * `irregular` maps irregular forms to their base forms ("went" → ["go"]).
 */
export function lemmaCandidates(word: string, irregular?: ReadonlyMap<string, readonly string[]>): string[] {
  const w = word.toLowerCase();
  const out = new Set<string>([w]);
  const add = (s: string | null) => {
    if (s && s.length >= 2) out.add(s);
  };

  const present = IRREGULAR_PRESENT[w];
  if (present) out.add(present);
  for (const base of irregular?.get(w) ?? []) out.add(base);

  // Plural nouns and 3rd person verbs.
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) {
    add(w.slice(0, -3) + 'f');
    add(w.slice(0, -3) + 'fe');
  }
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));

  // Past tense and participles.
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    add(stem);
    add(stem + 'e');
    add(undouble(stem));
  }

  // -ing forms.
  if (w.endsWith('ying')) add(w.slice(0, -4) + 'ie');
  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    add(stem);
    add(stem + 'e');
    add(undouble(stem));
  }

  // Comparatives and superlatives.
  for (const suffix of ['er', 'est']) {
    if (!w.endsWith(suffix)) continue;
    const stem = w.slice(0, -suffix.length);
    add(stem);
    add(stem + 'e');
    add(undouble(stem));
    if (stem.endsWith('i')) add(stem.slice(0, -1) + 'y');
  }

  return [...out];
}

/** Lowercased word forms of a lexicon headword, including multi-word phrases split into words. */
export function headwordTokens(headword: string): string[] {
  return tokenize(headword).flatMap((t) => expandContraction(t.lower));
}

/** Number of words in a learner's text (contractions count as one word). */
export function countWords(text: string): number {
  return tokenize(text).length;
}

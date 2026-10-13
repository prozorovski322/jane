/**
 * Builds a review session from due spaced-repetition cards.
 *
 * Words: shaky cards (new, learning, short stability) are practiced by recognition (pick the
 * translation, pick what you hear); stable cards by recall (type the English word). Grammar
 * cards reuse an exercise on that rule from the course, rotating so the learner does not see
 * the same sentence every time.
 */
import type { LexiconEntry } from '@/core/content/bundle-types';
import type { Exercise, ExerciseOf } from '@/core/content/schema';
import { State, type SrsCard } from '@/core/srs/scheduler';
import { hashString, shuffle } from '@/lib/random';

export interface ReviewSources {
  word: (id: string) => LexiconEntry | undefined;
  /** All lexicon entries, for distractors. */
  words: readonly LexiconEntry[];
  /** Course exercises that train a grammar note, from lessons the learner has seen. */
  grammarExercises: (noteId: string) => readonly Exercise[];
}

export const REVIEW_SIZE = 15;
const RECALL_STABILITY_DAYS = 7;
/** Exercise types that make sense out of their lesson context. */
const GRAMMAR_TYPES = new Set<Exercise['type']>([
  'fill_gap',
  'error_correction',
  'tiles',
  'type_translation',
  'translate_choice',
]);

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2'];

function explanation(w: LexiconEntry): string {
  // The learner's own words have no transcription.
  const head = w.ipa ? `${w.en} /${w.ipa}/` : w.en;
  const parts = [`${head} — ${w.ru.join(', ')}.`];
  if (w.example.en !== w.en) parts.push(`${w.example.en} — ${w.example.ru}`);
  if (w.note) parts.push(w.note);
  return parts.join(' ');
}

/** Distractors: same part of speech, not harder than the word, different meaning. */
function distractors(
  w: LexiconEntry,
  all: readonly LexiconEntry[],
  n: number,
  seed: string,
): LexiconEntry[] {
  const level = LEVEL_ORDER.indexOf(w.level);
  // A distractor must not be another correct answer: no shared translation in either direction.
  const fits = (o: LexiconEntry) =>
    o.id !== w.id &&
    !w.ru.includes(o.ru[0]!) &&
    !o.ru.includes(w.ru[0]!) &&
    o.en.toLowerCase() !== w.en.toLowerCase() &&
    LEVEL_ORDER.indexOf(o.level) <= level;
  const samePos = all.filter((o) => fits(o) && o.pos === w.pos);
  const pool = samePos.length >= n ? samePos : all.filter(fits);
  // Distractors must also differ from each other.
  const out: LexiconEntry[] = [];
  for (const o of shuffle(pool, seed)) {
    if (out.some((p) => p.ru[0] === o.ru[0] || p.en.toLowerCase() === o.en.toLowerCase())) continue;
    out.push(o);
    if (out.length === n) break;
  }
  return out;
}

/** Answers accepted for typing a word: with or without an article for nouns. */
function typedAnswers(w: LexiconEntry): string[] {
  const out = [w.en];
  if (w.pos === 'noun' && !w.en.includes(' ') && w.en[0] === w.en[0]!.toLowerCase()) {
    out.push(`${/^[aeiou]/i.test(w.en) ? 'an' : 'a'} ${w.en}`, `the ${w.en}`);
  }
  return out;
}

export function wordExercise(
  card: SrsCard,
  w: LexiconEntry,
  all: readonly LexiconEntry[],
  seed: string,
): Exercise {
  const base = {
    explanation: explanation(w),
    difficulty: 1 as const,
    words: [w.id],
    grammar: [],
    troubles: w.troubles,
  };
  const id = `review.${card.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const recall = card.state === State.Review && card.stability >= RECALL_STABILITY_DAYS;

  if (recall) {
    const ex: ExerciseOf<'type_translation'> = {
      ...base,
      id,
      type: 'type_translation',
      from: 'ru',
      text: w.ru[0]!,
      answers: typedAnswers(w),
      difficulty: 2,
      hint: `Начинается на «${w.en[0]}», букв: ${w.en.replace(/[^A-Za-z]/g, '').length}.`,
    };
    return ex;
  }

  const others = distractors(w, all, 2, seed);
  // Alternate recognition by reading and by ear.
  if (hashString(seed) % 3 === 0) {
    const ex: ExerciseOf<'listen_choice'> = {
      ...base,
      id,
      type: 'listen_choice',
      audio: w.en,
      question: 'Что вы слышите?',
      options: [w.en, ...others.map((o) => o.en)],
      answer: 0,
      hint: `Перевод: «${w.ru[0]}».`,
    };
    return ex;
  }
  const ex: ExerciseOf<'translate_choice'> = {
    ...base,
    id,
    type: 'translate_choice',
    from: 'en',
    text: w.en,
    options: [w.ru[0]!, ...others.map((o) => o.ru[0]!)],
    answer: 0,
    hint: `Пример: ${w.example.en}`,
  };
  return ex;
}

export function grammarExercise(card: SrsCard, sources: ReviewSources): Exercise | null {
  const candidates = sources.grammarExercises(card.ref).filter((e) => GRAMMAR_TYPES.has(e.type));
  if (!candidates.length) return null;
  // Rotate by the number of reviews so repeated reviews show different sentences.
  const pick = candidates[(hashString(card.ref) + card.reps) % candidates.length]!;
  return { ...pick, id: `review.${pick.id}`, grammar: [card.ref] };
}

/** Up to REVIEW_SIZE exercises for the most overdue cards; words and grammar interleaved. */
export function buildReview(
  cards: readonly SrsCard[],
  sources: ReviewSources,
  seed: string,
): Exercise[] {
  const out: Exercise[] = [];
  for (const card of cards) {
    if (out.length >= REVIEW_SIZE) break;
    if (card.kind === 'word') {
      const w = sources.word(card.ref);
      if (w) out.push(wordExercise(card, w, sources.words, `${seed}:${card.id}`));
    } else {
      const ex = grammarExercise(card, sources);
      if (ex) out.push(ex);
    }
  }
  return shuffle(out, seed);
}

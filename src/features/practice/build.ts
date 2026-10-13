/**
 * Practice sessions built from material the learner has already met: by skill, by grammar rule,
 * by typical difficulty, by words, and "weak spots" (what the answers show is hardest).
 */
import type { LexiconEntry } from '@/core/content/bundle-types';
import type { Exercise, Trouble } from '@/core/content/schema';
import type { SrsCard } from '@/core/srs/scheduler';
import { shuffle } from '@/lib/random';

import type { WeakSpot } from '../progress/insights';
import { wordExercise } from '../review/generate';

export const PRACTICE_KINDS = [
  'words',
  'grammar',
  'listening',
  'reading',
  'speaking',
  'writing',
  'pronunciation',
  'weak',
  'trouble',
  'mistakes',
  'grammar-mix',
] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export interface PracticeSpec {
  kind: PracticeKind;
  /** Grammar note id for "grammar", trouble id for "trouble". */
  ref?: string;
}

export function practiceId(spec: PracticeSpec): string {
  return spec.ref ? `practice.${spec.kind}.${spec.ref}` : `practice.${spec.kind}`;
}

export const PRACTICE_INFO: Record<PracticeKind, { title: string; subtitle: string }> = {
  words: { title: 'Слова', subtitle: 'Слова, которые даются труднее всего' },
  grammar: { title: 'Грамматика', subtitle: 'Одно правило — много примеров' },
  listening: { title: 'Аудирование', subtitle: 'Диктанты, «слышу и выбираю», диалоги' },
  reading: { title: 'Чтение', subtitle: 'Тексты и вопросы к ним' },
  speaking: { title: 'Говорение', subtitle: 'Повторить, ответить, рассказать' },
  writing: { title: 'Письмо', subtitle: 'Переводы и короткие тексты' },
  pronunciation: { title: 'Произношение', subtitle: 'Звуки, ударение, минимальные пары' },
  weak: { title: 'Слабые места', subtitle: 'То, в чём чаще всего ошибки' },
  trouble: { title: 'Трудность', subtitle: 'Целевая серия упражнений' },
  mistakes: { title: 'Ошибки', subtitle: 'Задания, в которых вы недавно ошиблись' },
  'grammar-mix': {
    title: 'Смешанная грамматика',
    subtitle: 'Разные правила вперемешку, чтобы не забыть пройденное',
  },
};

export interface PracticeSources {
  /** Exercises of lessons the learner has completed, in course order. */
  seen: readonly Exercise[];
  /** Every lesson exercise of the course (for rules the learner opens from the reference). */
  all: readonly Exercise[];
  wordCards: readonly SrsCard[];
  word: (id: string) => LexiconEntry | undefined;
  words: readonly LexiconEntry[];
  weak: readonly WeakSpot[];
  /** Exercises whose latest answer was wrong (the Mistakes section). */
  mistakes?: readonly Exercise[];
}

const LISTENING = new Set<Exercise['type']>(['listen_choice', 'listen_dictation', 'minimal_pair']);
const SPEAKING = new Set<Exercise['type']>(['speak_repeat', 'speak_answer', 'speak_describe']);
const PRONUNCIATION = new Set<Exercise['type']>(['minimal_pair', 'word_stress', 'speak_repeat']);

const LIMIT: Record<PracticeKind, number> = {
  words: 12,
  grammar: 10,
  listening: 8,
  reading: 3,
  speaking: 6,
  writing: 5,
  pronunciation: 10,
  weak: 12,
  trouble: 10,
  mistakes: 12,
  'grammar-mix': 12,
};

function uniqueById(list: readonly Exercise[]): Exercise[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Seen exercises first; when there are too few, the rest of the course fills in. */
function pick(
  src: PracticeSources,
  pred: (e: Exercise) => boolean,
  limit: number,
  seed: string,
): Exercise[] {
  const fromSeen = shuffle(src.seen.filter(pred), seed);
  const fill = fromSeen.length >= limit ? [] : shuffle(src.all.filter(pred), `${seed}:all`);
  return uniqueById([...fromSeen, ...fill]).slice(0, limit);
}

/** Word cards that cause trouble: most lapses, then least stable. */
function hardestWords(src: PracticeSources, limit: number, seed: string): Exercise[] {
  const cards = [...src.wordCards]
    .sort((a, b) => b.lapses - a.lapses || a.stability - b.stability)
    .slice(0, limit);
  return cards.flatMap((c) => {
    const w = src.word(c.ref);
    return w ? [wordExercise(c, w, src.words, `${seed}:${c.id}`)] : [];
  });
}

/**
 * Grammar from many rules at once: at most two exercises per rule, so one rule cannot crowd
 * out the rest. Only rules the learner has met are used.
 */
function mixedGrammar(src: PracticeSources, limit: number, seed: string): Exercise[] {
  const perRule = new Map<string, number>();
  const out: Exercise[] = [];
  for (const ex of shuffle(
    src.seen.filter((e) => e.grammar.length > 0),
    seed,
  )) {
    const rule = ex.grammar[0]!;
    if ((perRule.get(rule) ?? 0) >= 2) continue;
    perRule.set(rule, (perRule.get(rule) ?? 0) + 1);
    out.push(ex);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildPractice(spec: PracticeSpec, src: PracticeSources, seed: string): Exercise[] {
  const limit = LIMIT[spec.kind];
  let list: Exercise[];
  switch (spec.kind) {
    case 'words':
      list = hardestWords(src, limit, seed);
      break;
    case 'grammar':
      list = pick(src, (e) => !!spec.ref && e.grammar.includes(spec.ref), limit, seed);
      break;
    case 'mistakes':
      list = shuffle(src.mistakes ?? [], seed).slice(0, limit);
      break;
    case 'grammar-mix':
      list = mixedGrammar(src, limit, seed);
      break;
    case 'trouble':
      list = pick(src, (e) => !!spec.ref && e.troubles.includes(spec.ref as Trouble), limit, seed);
      break;
    case 'listening':
      list = shuffle(
        src.seen.filter(
          (e) => LISTENING.has(e.type) || (e.type === 'comprehension' && e.mode === 'listening'),
        ),
        seed,
      ).slice(0, limit);
      break;
    case 'reading':
      list = shuffle(
        src.seen.filter((e) => e.type === 'comprehension' && e.mode === 'reading'),
        seed,
      ).slice(0, limit);
      break;
    case 'speaking':
      list = shuffle(
        src.seen.filter((e) => SPEAKING.has(e.type)),
        seed,
      ).slice(0, limit);
      break;
    case 'writing':
      list = shuffle(
        src.seen.filter(
          (e) => e.type === 'write' || (e.type === 'type_translation' && e.from === 'ru'),
        ),
        seed,
      ).slice(0, limit);
      break;
    case 'pronunciation':
      list = shuffle(
        src.seen.filter((e) => PRONUNCIATION.has(e.type)),
        seed,
      ).slice(0, limit);
      break;
    case 'weak': {
      const spots = src.weak.slice(0, 3);
      const ruleExercises = spots.flatMap((s) =>
        pick(
          src,
          (e) =>
            s.kind === 'grammar'
              ? e.grammar.includes(s.ref)
              : e.troubles.includes(s.ref as Trouble),
          4,
          `${seed}:${s.ref}`,
        ),
      );
      const lapsed = src.wordCards.filter((c) => c.lapses > 0);
      const words = hardestWords({ ...src, wordCards: lapsed }, limit - ruleExercises.length, seed);
      list = shuffle(uniqueById([...ruleExercises, ...words]), seed).slice(0, limit);
      break;
    }
  }
  return list;
}

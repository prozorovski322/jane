/**
 * Checks a learner's response to any exercise type and returns a uniform verdict.
 * Pure functions: no UI, no storage. Option indexes always refer to the order in the content
 * file; the UI shuffles for display and maps back.
 */
import { checkWriting, type WritingResult } from '../checker/writing';
import { countKeywordGroups } from '../checker/patterns';
import { fillGaps, replaceFragment } from '../content/extract';
import type { Exercise, ExerciseOf } from '../content/schema';
import { normalizeAnswer, canonicalTokens } from './normalize';
import { missingWords, speechSimilarity } from './speech';
import { splitTiles } from './tiles';
import { matchTyped, type Typo, type TypedOptions } from './typed';

export type TfnAnswer = 'true' | 'false' | 'not_given';

export type Response =
  /** translate_choice, listen_choice, minimal_pair, word_stress: index in the content order. */
  | { kind: 'choice'; index: number }
  /** picture_choice: the chosen word id. */
  | { kind: 'word'; wordId: string }
  /** type_translation, listen_dictation, write, and the typed alternative to speaking. */
  | { kind: 'text'; text: string }
  | { kind: 'tiles'; tiles: string[] }
  | { kind: 'gaps'; values: string[] }
  /** error_correction: the fragment the learner tapped and the correction they chose. */
  | { kind: 'correction'; fragment: string; correction: string }
  /** match_pairs is checked pair by pair while playing; the final response reports mistakes. */
  | { kind: 'pairs'; mistakes: number }
  | { kind: 'answers'; answers: (number | TfnAnswer | null)[] }
  /** Speaking exercises: what the speech recognizer heard. */
  | { kind: 'speech'; transcript: string }
  /** Speaking exercises in self-check mode: the learner compared themselves with the sample. */
  | { kind: 'self'; ok: boolean };

export type Quality = 'perfect' | 'typo' | 'partial' | 'self' | 'wrong';

export interface Verdict {
  /** Counts as a correct answer for progress and scheduling. */
  correct: boolean;
  quality: Quality;
  /** 0..1, used for XP and for weighting the scheduler. */
  score: number;
  /** The correct answer to show after a mistake or a typo. */
  expected: string;
  typos?: Typo[];
  /** Per-part results: gaps of fill_gap, questions of comprehension. */
  parts?: boolean[];
  writing?: WritingResult;
  /** Speaking: share of the target heard, or keyword groups found. */
  speech?: { similarity?: number; missing?: string[]; keywords?: number; needed?: number };
}

export interface CheckOptions {
  isWord?: TypedOptions['isWord'];
  /** Display text of a word id (picture exercises refer to words by id). */
  wordLabel?: (id: string) => string | undefined;
}

const SELF_CHECK_SCORE = 0.7;

/** Whether a wrong verdict should send the exercise back into the lesson queue. */
export function needsRetry(v: Verdict): boolean {
  return v.quality === 'wrong';
}

function verdictOf(correct: boolean, expected: string, extra: Partial<Verdict> = {}): Verdict {
  return {
    correct,
    quality: correct ? 'perfect' : 'wrong',
    score: correct ? 1 : 0,
    expected,
    ...extra,
  };
}

function fraction(parts: boolean[]): number {
  return parts.length ? parts.filter(Boolean).length / parts.length : 0;
}

function partialVerdict(parts: boolean[], expected: string, extra: Partial<Verdict> = {}): Verdict {
  const score = fraction(parts);
  const quality: Quality = score === 1 ? 'perfect' : score >= 0.5 ? 'partial' : 'wrong';
  return { correct: score === 1, quality, score, expected, parts, ...extra };
}

/** Human-readable correct answer for the feedback panel. */
export function expectedAnswer(ex: Exercise, opts: CheckOptions = {}): string {
  switch (ex.type) {
    case 'translate_choice':
      return ex.options[ex.answer]!;
    case 'listen_choice':
      return ex.options[ex.answer]!;
    case 'picture_choice':
      return opts.wordLabel?.(ex.word) ?? ex.word;
    case 'tiles':
      return ex.answer;
    case 'type_translation':
      return ex.answers[0]!;
    case 'match_pairs':
      return ex.pairs.map((p) => `${p.en} — ${p.ru}`).join('; ');
    case 'fill_gap':
      return fillGaps(ex.text, ex.answers);
    case 'error_correction':
      return replaceFragment(ex.text, ex.wrong, ex.correction);
    case 'listen_dictation':
      return ex.text;
    case 'comprehension':
      return '';
    case 'speak_repeat':
      return ex.text;
    case 'speak_answer':
    case 'speak_describe':
    case 'write':
      return ex.samples[0]!;
    case 'minimal_pair':
      return ex.pair[ex.say].en;
    case 'word_stress':
      return ex.syllables.map((s, i) => (i === ex.stress ? s.toUpperCase() : s)).join('-');
  }
}

function typedVerdict(
  input: string,
  accepted: readonly string[],
  lang: 'en' | 'ru',
  opts: CheckOptions,
  expected: string,
): Verdict {
  const m = matchTyped(input, accepted, { lang, isWord: lang === 'en' ? opts.isWord : undefined });
  if (m.verdict === 'correct') return verdictOf(true, m.matched);
  if (m.verdict === 'typo')
    return { correct: true, quality: 'typo', score: 0.9, expected: m.matched, typos: m.typos };
  return verdictOf(false, expected);
}

function checkSpeaking(
  ex: ExerciseOf<'speak_repeat' | 'speak_answer' | 'speak_describe'>,
  said: string,
  expected: string,
): Verdict {
  if (ex.type === 'speak_repeat') {
    const similarity = speechSimilarity(said, ex.text);
    const quality: Quality =
      similarity >= 0.8 ? 'perfect' : similarity >= 0.5 ? 'partial' : 'wrong';
    return {
      correct: similarity >= 0.8,
      quality,
      score: similarity,
      expected,
      speech: { similarity, missing: similarity < 1 ? missingWords(said, ex.text) : [] },
    };
  }
  const keywords = countKeywordGroups(said, ex.keywords);
  const correct = keywords >= ex.minKeywords;
  const quality: Quality = correct ? 'perfect' : keywords > 0 ? 'partial' : 'wrong';
  return {
    correct,
    quality,
    score: Math.min(1, keywords / ex.minKeywords),
    expected,
    speech: { keywords, needed: ex.minKeywords },
  };
}

function mismatch(ex: Exercise, response: Response): never {
  throw new Error(`Response "${response.kind}" does not fit exercise ${ex.id} (${ex.type})`);
}

export function checkExercise(ex: Exercise, response: Response, opts: CheckOptions = {}): Verdict {
  const expected = expectedAnswer(ex, opts);

  if (response.kind === 'self') {
    if (ex.type !== 'speak_repeat' && ex.type !== 'speak_answer' && ex.type !== 'speak_describe')
      mismatch(ex, response);
    return response.ok
      ? { correct: true, quality: 'self', score: SELF_CHECK_SCORE, expected }
      : { correct: false, quality: 'wrong', score: 0, expected };
  }

  switch (ex.type) {
    case 'translate_choice':
    case 'listen_choice':
      if (response.kind !== 'choice') mismatch(ex, response);
      return verdictOf(response.index === ex.answer, expected);

    case 'minimal_pair':
      if (response.kind !== 'choice') mismatch(ex, response);
      return verdictOf(response.index === ex.say, expected);

    case 'word_stress':
      if (response.kind !== 'choice') mismatch(ex, response);
      return verdictOf(response.index === ex.stress, expected);

    case 'picture_choice':
      if (response.kind !== 'word') mismatch(ex, response);
      return verdictOf(response.wordId === ex.word, expected);

    case 'tiles': {
      if (response.kind !== 'tiles') mismatch(ex, response);
      const lang = ex.from === 'en' ? 'ru' : 'en';
      const built = canonicalTokens(response.tiles.join(' '), lang).join(' ');
      const ok = [ex.answer, ...ex.alternatives].some(
        (a) => canonicalTokens(a, lang).join(' ') === built,
      );
      return verdictOf(ok, expected);
    }

    case 'type_translation':
      if (response.kind !== 'text') mismatch(ex, response);
      return typedVerdict(
        response.text,
        ex.answers,
        ex.from === 'en' ? 'ru' : 'en',
        opts,
        expected,
      );

    case 'listen_dictation':
      if (response.kind !== 'text') mismatch(ex, response);
      return typedVerdict(response.text, [ex.text, ...ex.answers], 'en', opts, expected);

    case 'match_pairs': {
      if (response.kind !== 'pairs') mismatch(ex, response);
      const score = Math.max(0, 1 - response.mistakes * 0.2);
      return { correct: true, quality: response.mistakes ? 'partial' : 'perfect', score, expected };
    }

    case 'fill_gap': {
      if (response.kind !== 'gaps') mismatch(ex, response);
      const typos: Typo[] = [];
      const parts = ex.answers.map((accepted, i) => {
        const value = response.values[i] ?? '';
        if (ex.options) return accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(value));
        const m = matchTyped(value, accepted, { lang: 'en', isWord: opts.isWord });
        if (m.verdict === 'typo') typos.push(...m.typos);
        return m.verdict !== 'wrong';
      });
      const v = partialVerdict(parts, expected);
      // A gap sentence is short: anything less than all gaps right needs another try.
      if (!v.correct) return { ...v, quality: 'wrong' };
      return typos.length ? { ...v, quality: 'typo', score: 0.9, typos } : v;
    }

    case 'error_correction': {
      if (response.kind !== 'correction') mismatch(ex, response);
      const wrongTokens = new Set(splitTiles(ex.wrong).map(normalizeAnswer));
      const found = wrongTokens.has(normalizeAnswer(response.fragment));
      const fixed = normalizeAnswer(response.correction) === normalizeAnswer(ex.correction);
      return partialVerdict([found, fixed], expected);
    }

    case 'comprehension': {
      if (response.kind !== 'answers') mismatch(ex, response);
      const parts = ex.questions.map((q, i) => response.answers[i] === q.answer);
      return partialVerdict(parts, expected);
    }

    case 'speak_repeat':
    case 'speak_answer':
    case 'speak_describe':
      if (response.kind === 'speech') return checkSpeaking(ex, response.transcript, expected);
      // Typed alternative for learners who cannot speak right now: same scoring.
      if (response.kind === 'text') return checkSpeaking(ex, response.text, expected);
      return mismatch(ex, response);

    case 'write': {
      if (response.kind !== 'text') mismatch(ex, response);
      const writing = checkWriting(response.text, ex);
      const quality: Quality = writing.passed
        ? 'perfect'
        : writing.score >= 0.5
          ? 'partial'
          : 'wrong';
      return { correct: writing.passed, quality, score: writing.score, expected, writing };
    }
  }
}

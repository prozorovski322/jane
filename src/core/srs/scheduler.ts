/**
 * Spaced repetition with FSRS (ts-fsrs). Every word and every grammar rule the learner meets gets
 * a card that stores stability, difficulty and the next review date.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type FSRS, type Grade } from 'ts-fsrs';

export type CardKind = 'word' | 'grammar';

export interface SrsCard extends Card {
  id: string;
  kind: CardKind;
  ref: string;
  createdAt: number;
}

export { Rating, State };

export function cardId(kind: CardKind, ref: string): string {
  return `${kind}:${ref}`;
}

export function createScheduler(opts: { fuzz?: boolean } = {}): FSRS {
  return fsrs({
    request_retention: 0.9,
    // A year is plenty for a course; long gaps are better caught by placement re-checks.
    maximum_interval: 365,
    enable_fuzz: opts.fuzz ?? true,
  });
}

export function newCard(kind: CardKind, ref: string, now: Date): SrsCard {
  return { ...createEmptyCard(now), id: cardId(kind, ref), kind, ref, createdAt: now.getTime() };
}

export interface AnswerOutcome {
  correct: boolean;
  score: number;
  usedHint: boolean;
}

/**
 * How well the learner knew it: a clean first-try answer is Good, a correct answer with a hint,
 * a typo or a partial score is Hard, a wrong answer is Again. Easy is never inferred.
 */
export function ratingFor(o: AnswerOutcome): Grade {
  if (!o.correct) return Rating.Again;
  if (o.usedHint || o.score < 1) return Rating.Hard;
  return Rating.Good;
}

/** Of several answers about the same card in one session, the weakest one decides. */
export function worstRating(ratings: readonly Grade[]): Grade {
  return ratings.reduce((a, b) => (b < a ? b : a), Rating.Easy as Grade);
}

export function review(scheduler: FSRS, card: SrsCard, rating: Grade, now: Date) {
  const { card: next, log } = scheduler.next(card, now, rating);
  return { card: { ...card, ...next } as SrsCard, log };
}

/** Known well enough that easy recognition exercises on it can be skipped. */
export function isMastered(card: Card): boolean {
  return card.state === State.Review && card.stability >= 21;
}

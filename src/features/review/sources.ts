import { getCourse, getLexicon, getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';
import { isMastered, type SrsCard } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { allCards, dueCards } from '@/core/storage/srs-repo';
import { hashString } from '@/lib/random';
import { dayOf } from '@/core/progress/dates';

import type { LessonSession } from '../lesson/session';
import { textsFor } from '../lesson/session';
import { buildReview, REVIEW_SIZE, type ReviewSources } from './generate';

/** Exercises of lessons the learner has completed, for grammar reviews. */
export function reviewSources(completedLessons: ReadonlySet<string>): ReviewSources {
  const lexicon = getLexicon();
  const seen: Exercise[] = [];
  for (const level of getCourse().levels) {
    for (const u of level.units) {
      const unit = getUnit(u.id);
      for (const l of unit.lessons) if (completedLessons.has(l.id)) seen.push(...l.exercises);
    }
  }
  return {
    word: (id) => lexicon.get(id),
    words: [...lexicon.values()],
    grammarExercises: (id) => seen.filter((e) => e.grammar.includes(id)),
  };
}

/** Today's review session from the most overdue cards. */
export async function loadReviewSession(
  db: Db,
  completedLessons: ReadonlySet<string>,
  now = new Date(),
): Promise<LessonSession> {
  const cards = await dueCards(db, now, REVIEW_SIZE * 2);
  // One seed per day: reopening the review the same day shows the same exercises.
  const exercises = buildReview(
    cards,
    reviewSources(completedLessons),
    `${dayOf(now)}:${hashString(cards.map((c) => c.id).join())}`,
  );
  return {
    id: 'review',
    title: 'Повторение',
    kind: 'review',
    unitId: null,
    exercises,
    texts: textsFor(exercises),
  };
}

/**
 * Leaves out easy exercises whose words and rules are all mastered. Used when a learner repeats
 * a lesson, so the repeat is about what they still need.
 */
export function masteredSkip(cards: readonly SrsCard[]): (ex: Exercise) => boolean {
  const mastered = new Set(cards.filter(isMastered).map((c) => c.id));
  return (ex) =>
    ex.difficulty === 1 &&
    ex.words.length > 0 &&
    ex.words.every((w) => mastered.has(`word:${w}`)) &&
    ex.grammar.every((g) => mastered.has(`grammar:${g}`));
}

export async function loadMasteredSkip(db: Db) {
  return masteredSkip(await allCards(db));
}

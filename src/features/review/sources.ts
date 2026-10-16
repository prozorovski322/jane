import { getCourse, getLexicon, getUnit, loadUnits } from '@/core/content';
import type { LexiconEntry } from '@/core/content/bundle-types';
import type { Exercise } from '@/core/content/schema';
import { isMastered, type SrsCard } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { allCards, dueCards } from '@/core/storage/srs-repo';
import { hashString } from '@/lib/random';
import { dayOf } from '@/core/progress/dates';

import { loadOwnLexicon } from '../dictionary/load';
import type { LessonSession } from '../lesson/session';
import { textsFor } from '../lesson/session';
import { buildReview, REVIEW_SIZE, type ReviewSources } from './generate';

/** Units of the course levels with at least one completed lesson (or all of them). */
function unitsWithLessons(completedLessons?: ReadonlySet<string>): string[] {
  return getCourse().levels.flatMap((level) =>
    level.units
      .filter((u) => !completedLessons || u.lessons.some((l) => completedLessons.has(l.id)))
      .map((u) => u.id),
  );
}

/**
 * Exercises of completed lessons (or of all lessons), in course order. On the website the units
 * must be loaded first: use `loadCourseExercises`.
 */
export function courseExercises(completedLessons?: ReadonlySet<string>): Exercise[] {
  const out: Exercise[] = [];
  for (const id of unitsWithLessons(completedLessons)) {
    for (const l of getUnit(id).lessons) {
      if (!completedLessons || completedLessons.has(l.id)) out.push(...l.exercises);
    }
  }
  return out;
}

/** `courseExercises` after loading the units it reads. */
export async function loadCourseExercises(
  completedLessons?: ReadonlySet<string>,
): Promise<Exercise[]> {
  await loadUnits(unitsWithLessons(completedLessons));
  return courseExercises(completedLessons);
}

/**
 * Sources for reviews: course words plus the learner's own words; grammar exercises from
 * completed lessons. Own words are looked up but never used as distractors.
 */
export function reviewSources(
  completedLessons: ReadonlySet<string>,
  ownWords: readonly LexiconEntry[] = [],
): ReviewSources {
  const lexicon = getLexicon();
  const own = new Map(ownWords.map((w) => [w.id, w]));
  const seen = courseExercises(completedLessons);
  return {
    word: (id) => lexicon.get(id) ?? own.get(id),
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
  const [cards, own] = await Promise.all([
    dueCards(db, now, REVIEW_SIZE * 2),
    loadOwnLexicon(db),
    loadCourseExercises(completedLessons),
  ]);
  // One seed per day: reopening the review the same day shows the same exercises.
  const exercises = buildReview(
    cards,
    reviewSources(completedLessons, own),
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

import { getLexicon } from '@/core/content';
import { dayOf } from '@/core/progress/dates';
import type { Db } from '@/core/storage/db';
import { allCards } from '@/core/storage/srs-repo';

import { loadOwnLexicon } from '../dictionary/load';
import type { LessonSession } from '../lesson/session';
import { textsFor } from '../lesson/session';
import { loadWeakSpots } from '../progress/insights';
import { courseExercises } from '../review/sources';
import {
  buildPractice,
  practiceId,
  PRACTICE_INFO,
  type PracticeSources,
  type PracticeSpec,
} from './build';

export async function loadPracticeSources(
  db: Db,
  completed: ReadonlySet<string>,
): Promise<PracticeSources> {
  const [cards, own, weak] = await Promise.all([
    allCards(db, 'word'),
    loadOwnLexicon(db),
    loadWeakSpots(db),
  ]);
  const lexicon = getLexicon();
  const ownById = new Map(own.map((w) => [w.id, w]));
  return {
    seen: courseExercises(completed),
    all: courseExercises(),
    wordCards: cards,
    word: (id) => lexicon.get(id) ?? ownById.get(id),
    words: [...lexicon.values()],
    weak,
  };
}

export async function loadPracticeSession(
  db: Db,
  spec: PracticeSpec,
  completed: ReadonlySet<string>,
  title: string,
  now = new Date(),
): Promise<LessonSession> {
  const src = await loadPracticeSources(db, completed);
  // A new mix every day; the same mix if reopened during the day.
  const exercises = buildPractice(spec, src, `${dayOf(now)}:${practiceId(spec)}`);
  return {
    id: practiceId(spec),
    title: title || PRACTICE_INFO[spec.kind].title,
    kind: 'practice',
    unitId: null,
    exercises,
    texts: textsFor(exercises),
  };
}

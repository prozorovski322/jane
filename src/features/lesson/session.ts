import { getLesson, getUnit } from '@/core/content';
import type { Exercise, Text } from '@/core/content/schema';
import type { SessionKind } from '@/core/progress/xp';

/** Anything the lesson screen can run: a lesson, a unit test, a review or practice session. */
export interface LessonSession {
  id: string;
  title: string;
  kind: SessionKind;
  unitId: string | null;
  exercises: Exercise[];
  /** Texts the exercises refer to (reading passages, dialogues). */
  texts: Text[];
  /** Unit tests: minimum mean score to pass. */
  passScore?: number;
}

export function sessionForLesson(id: string): LessonSession | null {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return {
    id: lesson.id,
    title: lesson.title,
    kind: lesson.isTest ? 'test' : 'lesson',
    unitId: lesson.unit.id,
    exercises: lesson.exercises,
    texts: lesson.unit.texts,
    passScore: lesson.isTest ? lesson.unit.test.passScore : undefined,
  };
}

/** Texts of every unit an exercise list may refer to (review sessions mix units). */
export function textsFor(exercises: readonly Exercise[]): Text[] {
  const unitIds = new Set(
    exercises.map((e) =>
      e.id
        .replace(/^review\./, '')
        .split('.')
        .slice(0, 2)
        .join('.'),
    ),
  );
  return [...unitIds].flatMap((id) => {
    try {
      return getUnit(id).texts;
    } catch {
      return [];
    }
  });
}

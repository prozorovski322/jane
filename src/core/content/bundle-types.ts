/**
 * Shapes of the compiled content bundle in `src/core/content/generated/`, produced by
 * `npm run content:build` from the sources in `content/`.
 */
import type { Course, GrammarNote, Lesson, Level, Unit, Word } from './schema';

export interface LessonOutline {
  id: string;
  kind: Lesson['kind'];
  title: string;
  exerciseCount: number;
}

export interface UnitOutline {
  id: string;
  level: Level;
  order: number;
  title: Unit['title'];
  description: string;
  goals: string[];
  grammar: string[];
  wordCount: number;
  lessons: LessonOutline[];
  testExerciseCount: number;
}

export interface CourseOutline {
  version: Course['version'];
  levels: {
    level: Level;
    title: string;
    description: string;
    units: UnitOutline[];
  }[];
}

export interface LexiconEntry extends Word {
  unit: string;
  level: Level;
}

/** A unit as shipped in the bundle: words live in the lexicon and are referenced by id. */
export type UnitBundle = Omit<Unit, 'words'> & { wordIds: string[] };

export type GrammarBundle = GrammarNote[];

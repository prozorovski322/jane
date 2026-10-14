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

export interface ModuleOutline {
  id: string;
  order: number;
  title: Unit['title'];
  goals: string[];
  /** Written units of the module. */
  units: UnitOutline[];
  /** Units still to be written (shown as "soon"). */
  planned: { id: string; title: Unit['title'] }[];
}

export interface LevelOutline {
  level: Level;
  title: string;
  description: string;
  canDo: string[];
  vocabTarget: number;
  grammarScope: string[];
  functions: string[];
  modules: ModuleOutline[];
  /** All written units of the level in course order (the modules' units, flattened). */
  units: UnitOutline[];
}

/** An optional branch opened by the certificate of `requires` (or a higher level). */
export interface TrackOutline {
  id: string;
  title: Unit['title'];
  description: string;
  requires: Level;
  /** Written units of the track in order. */
  units: UnitOutline[];
  planned: { id: string; title: Unit['title'] }[];
}

export interface CourseOutline {
  version: Course['version'];
  levels: LevelOutline[];
  tracks: TrackOutline[];
}

export interface LexiconEntry extends Word {
  unit: string;
  level: Level;
}

/** A unit as shipped in the bundle: words live in the lexicon and are referenced by id. */
export type UnitBundle = Omit<Unit, 'words'> & { wordIds: string[] };

export type GrammarBundle = GrammarNote[];

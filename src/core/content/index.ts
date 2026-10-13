/**
 * Runtime access to the compiled course content. Units are loaded lazily and cached.
 */
import type { CourseOutline, GrammarBundle, LexiconEntry, UnitBundle } from './bundle-types';
import { loadCourse, loadGrammar, loadLexicon, loadPlacement, unitLoaders } from './generated';
import type { Exercise, PlacementBank } from './schema';

let course: CourseOutline | null = null;
let lexicon: Map<string, LexiconEntry> | null = null;
let grammar: Map<string, GrammarBundle[number]> | null = null;
const units = new Map<string, UnitBundle>();

export function getCourse(): CourseOutline {
  course ??= loadCourse();
  return course;
}

export function getUnit(id: string): UnitBundle {
  let unit = units.get(id);
  if (!unit) {
    const load = unitLoaders[id];
    if (!load) throw new Error(`Unknown unit ${id}`);
    unit = load();
    units.set(id, unit);
  }
  return unit;
}

export function getLexicon(): Map<string, LexiconEntry> {
  lexicon ??= new Map(loadLexicon().map((w) => [w.id, w]));
  return lexicon;
}

export interface ResolvedLesson {
  id: string;
  title: string;
  unit: UnitBundle;
  exercises: Exercise[];
  isTest: boolean;
}

/** A lesson by id ("a1.u01.l03"), or the unit test ("a1.u01.test"). */
export function getLesson(id: string): ResolvedLesson | null {
  const unitId = id.split('.').slice(0, 2).join('.');
  if (!unitLoaders[unitId]) return null;
  const unit = getUnit(unitId);
  if (id === `${unitId}.test`) {
    return {
      id,
      title: `Тест: ${unit.title.ru}`,
      unit,
      exercises: unit.test.exercises,
      isTest: true,
    };
  }
  const lesson = unit.lessons.find((l) => l.id === id);
  return lesson
    ? { id, title: lesson.title, unit, exercises: lesson.exercises, isTest: false }
    : null;
}

let words: Set<string> | null = null;

/** Single English words of the course lexicon, lowercased; used to tell typos from other words. */
export function isCourseWord(w: string): boolean {
  words ??= new Set(
    [...getLexicon().values()].filter((e) => !e.en.includes(' ')).map((e) => e.en.toLowerCase()),
  );
  return words.has(w.toLowerCase());
}

let placement: PlacementBank | null = null;

export function getPlacementBank(): PlacementBank {
  placement ??= loadPlacement();
  return placement;
}

export function getGrammarNote(id: string): GrammarBundle[number] | undefined {
  grammar ??= new Map(loadGrammar().map((g) => [g.id, g]));
  return grammar.get(id);
}

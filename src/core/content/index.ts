/**
 * Runtime access to the compiled course content. Units are loaded lazily and cached.
 *
 * The app bundles every unit and reads it on first use. The website downloads units on demand:
 * call `loadUnits` (or a helper built on it) before `getUnit` for anything a screen needs.
 */
import type {
  CourseOutline,
  GrammarBundle,
  LexiconEntry,
  UnitBundle,
  UnitOutline,
} from './bundle-types';
import { loadCourse, loadGrammar, loadLexicon, loadPlacement, unitIds } from './generated';
import { fetchUnit, loadUnitSync } from './generated/units';
import type { Exercise, PlacementBank } from './schema';

let course: CourseOutline | null = null;
let lexicon: Map<string, LexiconEntry> | null = null;
let grammar: Map<string, GrammarBundle[number]> | null = null;
const units = new Map<string, UnitBundle>();
const knownUnits = new Set(unitIds);

export function getCourse(): CourseOutline {
  course ??= loadCourse();
  return course;
}

/** Whether a unit with this id exists in the course. */
export const isKnownUnit = (id: string) => knownUnits.has(id);

/** The unit an exercise or lesson id belongs to: "a1.u01.l03.e05" → "a1.u01". */
export const unitIdOf = (id: string) => id.split('.').slice(0, 2).join('.');

/** A unit's full content. On the website it must have been loaded with `loadUnits` first. */
export function getUnit(id: string): UnitBundle {
  let unit = units.get(id);
  if (!unit) {
    if (!knownUnits.has(id)) throw new Error(`Unknown unit ${id}`);
    unit = loadUnitSync(id);
    if (!unit) throw new Error(`Unit ${id} is not loaded yet`);
    units.set(id, unit);
  }
  return unit;
}

const pending = new Map<string, Promise<void>>();

/** Makes the given units available to `getUnit`; unknown ids are ignored. */
export async function loadUnits(ids: Iterable<string>): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => knownUnits.has(id) && !units.has(id));
  await Promise.all(
    missing.map((id) => {
      let p = pending.get(id);
      if (!p) {
        p = (async () => {
          units.set(id, loadUnitSync(id) ?? (await fetchUnit(id)));
        })().finally(() => pending.delete(id));
        pending.set(id, p);
      }
      return p;
    }),
  );
}

/** Units of the course levels (not the optional tracks), in course order. */
export const levelUnitIds = () => getCourse().levels.flatMap((l) => l.units.map((u) => u.id));

/** Outline of a unit (title, lessons) without loading its content. */
export function getUnitOutline(id: string): UnitOutline | undefined {
  const c = getCourse();
  return [...c.levels.flatMap((l) => l.units), ...c.tracks.flatMap((t) => t.units)].find(
    (u) => u.id === id,
  );
}

/** Title of a lesson or unit test from the outline, without loading the unit. */
export function lessonTitle(id: string): string | undefined {
  const unit = getUnitOutline(unitIdOf(id));
  if (!unit) return undefined;
  if (id === `${unit.id}.test`) return `Тест: ${unit.title.ru}`;
  return unit.lessons.find((l) => l.id === id)?.title;
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
  const unitId = unitIdOf(id);
  if (!knownUnits.has(unitId)) return null;
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

/**
 * Runtime access to the compiled course content. Units are loaded lazily and cached.
 */
import type { CourseOutline, GrammarBundle, LexiconEntry, UnitBundle } from './bundle-types';
import { loadCourse, loadGrammar, loadLexicon, unitLoaders } from './generated';

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

export function getGrammarNote(id: string): GrammarBundle[number] | undefined {
  grammar ??= new Map(loadGrammar().map((g) => [g.id, g]));
  return grammar.get(id);
}

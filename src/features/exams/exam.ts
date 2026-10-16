/**
 * Module tests and level exams. They are not written separately: they are assembled from the
 * exercises of the units they cover, balanced by skill, so a test always matches what the course
 * actually teaches. A test is available once every unit of the module (or level) is written.
 */
import { getCourse, getUnit, loadUnits } from '@/core/content';
import type { LevelOutline, ModuleOutline, TrackOutline } from '@/core/content/bundle-types';
import type { Exercise, Level, Skill, Text } from '@/core/content/schema';
import { LEVEL_LABEL, LEVELS } from '@/core/content/schema';
import { shuffle } from '@/lib/random';

import { skillOf } from '../lesson/engine';
import type { LessonSession } from '../lesson/session';

export const MODULE_TEST = { size: 20, passScore: 0.7 } as const;
export const LEVEL_EXAM = { size: 50, passScore: 0.75 } as const;
/** Final test of an optional track; passing it marks the track done (no certificate). */
export const TRACK_TEST = { size: 30, passScore: 0.75 } as const;

/** Share of each skill in a test; what a skill lacks in the pool is filled from the others. */
const SHARE: Record<Skill, number> = {
  vocabulary: 0.22,
  grammar: 0.24,
  listening: 0.16,
  reading: 0.12,
  speaking: 0.08,
  pronunciation: 0.1,
  writing: 0.08,
};

export type ExamRef =
  | { kind: 'module'; moduleId: string; level: Level }
  | { kind: 'level'; level: Level }
  | { kind: 'track'; trackId: string };

const MODULE_RE = /^([a-z0-9]+)\.m(\d+)\.test$/;
const LEVEL_RE = /^([a-z0-9]+)\.exam$/;

export const moduleTestId = (moduleId: string) => `${moduleId}.test`;
export const levelExamId = (level: Level) => `${level.toLowerCase()}.exam`;
export const trackTestId = (trackId: string) => `${trackId}.exam`;

function levelByCode(code: string): Level | null {
  return LEVELS.find((l) => l.toLowerCase() === code) ?? null;
}

/** Whether an id is a module test ("a1.m1.test"), a level exam ("a1.exam") or a track test ("travel.exam"). */
export function parseExamId(id: string): ExamRef | null {
  const m = MODULE_RE.exec(id);
  if (m) {
    const level = levelByCode(m[1]!);
    return level ? { kind: 'module', moduleId: id.replace(/\.test$/, ''), level } : null;
  }
  const l = LEVEL_RE.exec(id);
  if (!l) return null;
  const level = levelByCode(l[1]!);
  if (level) return { kind: 'level', level };
  return getCourse().tracks.some((t) => t.id === l[1]) ? { kind: 'track', trackId: l[1]! } : null;
}

export const isExamId = (id: string) => parseExamId(id) !== null;

/** Every unit of the module is written. */
export const isModuleReady = (m: ModuleOutline) => m.planned.length === 0 && m.units.length > 0;
/** Every module of the level is ready. */
export const isLevelReady = (l: LevelOutline) => l.modules.every(isModuleReady);
/** Every unit of the track is written. */
export const isTrackReady = (t: TrackOutline) => t.planned.length === 0 && t.units.length > 0;

/** Exercises of the given units: lessons first, then unit tests, without duplicates. */
function poolOf(unitIds: readonly string[]): { exercises: Exercise[]; texts: Text[] } {
  const exercises: Exercise[] = [];
  const texts: Text[] = [];
  const seen = new Set<string>();
  for (const id of unitIds) {
    const unit = getUnit(id);
    texts.push(...unit.texts);
    for (const ex of [...unit.lessons.flatMap((l) => l.exercises), ...unit.test.exercises]) {
      if (seen.has(ex.id)) continue;
      seen.add(ex.id);
      exercises.push(ex);
    }
  }
  return { exercises, texts };
}

/** Picks `size` exercises from the pool, by skill share, in a seeded random order. */
export function selectExercises(pool: readonly Exercise[], size: number, seed: string): Exercise[] {
  const bySkill = new Map<Skill, Exercise[]>();
  for (const ex of shuffle(pool, `${seed}:pool`)) {
    const skill = skillOf(ex);
    bySkill.set(skill, [...(bySkill.get(skill) ?? []), ex]);
  }
  const chosen: Exercise[] = [];
  for (const [skill, list] of bySkill) {
    chosen.push(...list.slice(0, Math.max(1, Math.round(size * SHARE[skill]))));
  }
  // A skill with little material leaves room: fill it from what is left.
  if (chosen.length < size) {
    const taken = new Set(chosen.map((e) => e.id));
    chosen.push(...shuffle(pool, `${seed}:fill`).filter((e) => !taken.has(e.id)));
  }
  return shuffle(chosen.slice(0, size), `${seed}:order`);
}

/** Units a test is assembled from (to load them first on the website); empty if unknown. */
export function examUnitIds(id: string): string[] {
  const ref = parseExamId(id);
  if (!ref) return [];
  const course = getCourse();
  if (ref.kind === 'track') {
    return course.tracks.find((t) => t.id === ref.trackId)?.units.map((u) => u.id) ?? [];
  }
  const level = course.levels.find((l) => l.level === ref.level);
  if (!level) return [];
  const units =
    ref.kind === 'module' ? level.modules.find((m) => m.id === ref.moduleId)?.units : level.units;
  return units?.map((u) => u.id) ?? [];
}

/** `sessionForExam` after loading the units it draws on. */
export async function loadExamSession(id: string, seed: string): Promise<LessonSession | null> {
  await loadUnits(examUnitIds(id));
  return sessionForExam(id, seed);
}

/** Module test or level exam as a lesson session, or null if unknown or not ready yet. */
export function sessionForExam(id: string, seed: string): LessonSession | null {
  const ref = parseExamId(id);
  if (!ref) return null;

  if (ref.kind === 'track') {
    const track = getCourse().tracks.find((t) => t.id === ref.trackId);
    if (!track || !isTrackReady(track)) return null;
    const { exercises, texts } = poolOf(track.units.map((u) => u.id));
    return {
      id,
      title: `Итоговый тест: ${track.title.ru}`,
      kind: 'test',
      unitId: track.id,
      exercises: selectExercises(exercises, TRACK_TEST.size, `${id}:${seed}`),
      texts,
      passScore: TRACK_TEST.passScore,
    };
  }

  const level = getCourse().levels.find((l) => l.level === ref.level);
  if (!level) return null;

  if (ref.kind === 'module') {
    const module = level.modules.find((m) => m.id === ref.moduleId);
    if (!module || !isModuleReady(module)) return null;
    const { exercises, texts } = poolOf(module.units.map((u) => u.id));
    return {
      id,
      title: `Контрольная: ${module.title.ru}`,
      kind: 'test',
      unitId: module.id,
      exercises: selectExercises(exercises, MODULE_TEST.size, `${id}:${seed}`),
      texts,
      passScore: MODULE_TEST.passScore,
    };
  }

  if (!isLevelReady(level)) return null;
  const { exercises, texts } = poolOf(level.units.map((u) => u.id));
  return {
    id,
    title: `Экзамен уровня ${LEVEL_LABEL[level.level]}`,
    kind: 'test',
    unitId: level.level.toLowerCase(),
    exercises: selectExercises(exercises, LEVEL_EXAM.size, `${id}:${seed}`),
    texts,
    passScore: LEVEL_EXAM.passScore,
  };
}

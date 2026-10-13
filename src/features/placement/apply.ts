/**
 * Turns a placement result into course progress: lessons the learner clearly knows are credited
 * (marked done with source "placement"). Credit is only ever added: a later, weaker test never
 * takes away lessons that were completed or credited before.
 */
import type { CourseOutline } from '@/core/content/bundle-types';
import { LEVELS } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';

import type { PlacementResult } from './engine';

/** Share of the current level's units credited at the very top of the level. */
const WITHIN_LEVEL_SHARE = 0.7;

export function lessonsToCredit(
  course: CourseOutline,
  r: PlacementResult,
): { lessonId: string; unitId: string }[] {
  if (r.fromZero) return [];
  const target = LEVELS.indexOf(r.level);
  const out: { lessonId: string; unitId: string }[] = [];
  for (const level of course.levels) {
    const idx = LEVELS.indexOf(level.level);
    let units = level.units;
    if (idx === target)
      units = units.slice(0, Math.floor(r.position * units.length * WITHIN_LEVEL_SHARE));
    else if (idx > target) units = [];
    for (const u of units) {
      for (const l of u.lessons) out.push({ lessonId: l.id, unitId: u.id });
      out.push({ lessonId: `${u.id}.test`, unitId: u.id });
    }
  }
  return out;
}

export interface StoredPlacement {
  at: number;
  theta: number;
  sd: number;
  level: PlacementResult['level'];
  answered: number;
  correct: number;
  credited: number;
}

const KEY = 'placement.history';

export async function placementHistory(db: Db): Promise<StoredPlacement[]> {
  return kvGet<StoredPlacement[]>(db, KEY, []);
}

export async function lastPlacement(db: Db): Promise<StoredPlacement | null> {
  return (await placementHistory(db)).at(-1) ?? null;
}

/** Saves the result and credits lessons. Returns how many lessons were newly credited. */
export async function applyPlacement(
  db: Db,
  course: CourseOutline,
  r: PlacementResult,
  now = new Date(),
): Promise<number> {
  const lessons = lessonsToCredit(course, r);
  let credited = 0;
  await db.transaction(async () => {
    for (const l of lessons) {
      const res = await db.run(
        `INSERT INTO lesson_progress (lesson_id, unit_id, first_completed_at, last_completed_at, best_score, passed, times, source)
         VALUES (?, ?, ?, ?, 1, 1, 0, 'placement')
         ON CONFLICT (lesson_id) DO NOTHING`,
        [l.lessonId, l.unitId, now.getTime(), now.getTime()],
      );
      credited += res.changes;
    }
    const history = await placementHistory(db);
    const entry: StoredPlacement = {
      at: now.getTime(),
      theta: r.theta,
      sd: r.sd,
      level: r.level,
      answered: r.answered,
      correct: r.correct,
      credited,
    };
    await kvSet(db, KEY, [...history, entry].slice(-10));
  });
  return credited;
}

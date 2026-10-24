import type { CourseOutline } from '@/core/content/bundle-types';
import { pathState } from '../path/state';

/** Counts written course lessons only; tests and optional practice never inflate them. */
export function learningOverview(course: CourseOutline, completed: ReadonlySet<string>) {
  const path = pathState(course, completed);
  const current =
    path.levels.find((l) => l.units.some((u) => u.nodes.some((n) => n.status !== 'done'))) ??
    path.levels[path.levels.length - 1];
  const lessons = current?.units.flatMap((u) => u.nodes.filter((n) => !n.isTest)) ?? [];
  const done = lessons.filter((n) => completed.has(n.id)).length;
  const totalDone = path.levels
    .flatMap((l) => l.units.flatMap((u) => u.nodes))
    .filter((n) => !n.isTest && completed.has(n.id)).length;
  return {
    current,
    done,
    total: lessons.length,
    totalDone,
    ratio: lessons.length ? done / lessons.length : 0,
    next: path.next,
  };
}

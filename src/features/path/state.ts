/**
 * State of the learning path: what is done, what is next. Every lesson is open (a learner may
 * start anywhere); "next" is simply the first unfinished lesson in course order.
 */
import type { CourseOutline } from '@/core/content/bundle-types';
import type { Level } from '@/core/content/schema';

export type NodeStatus = 'done' | 'next' | 'open';

export interface PathNode {
  id: string;
  title: string;
  kind: string;
  isTest: boolean;
  status: NodeStatus;
}

export interface PathUnit {
  id: string;
  order: number;
  title: { en: string; ru: string };
  grammar: string[];
  nodes: PathNode[];
  done: number;
  total: number;
}

export interface PathLevel {
  level: Level;
  title: string;
  units: PathUnit[];
  done: number;
  total: number;
}

export interface PathState {
  levels: PathLevel[];
  next: { node: PathNode; unitId: string } | null;
}

export function pathState(course: CourseOutline, completed: ReadonlySet<string>): PathState {
  let next: PathState['next'] = null;
  const levels = course.levels.map((l) => {
    const units = l.units.map((u) => {
      const raw = [
        ...u.lessons.map((ls) => ({ id: ls.id, title: ls.title, kind: ls.kind, isTest: false })),
        { id: `${u.id}.test`, title: 'Тест юнита', kind: 'test', isTest: true },
      ];
      const nodes: PathNode[] = raw.map((n) => {
        if (completed.has(n.id)) return { ...n, status: 'done' };
        if (!next) {
          const node: PathNode = { ...n, status: 'next' };
          next = { node, unitId: u.id };
          return node;
        }
        return { ...n, status: 'open' };
      });
      const done = nodes.filter((n) => n.status === 'done').length;
      return {
        id: u.id,
        order: u.order,
        title: u.title,
        grammar: u.grammar,
        nodes,
        done,
        total: nodes.length,
      };
    });
    return {
      level: l.level,
      title: l.title,
      units,
      done: units.reduce((n, u) => n + u.done, 0),
      total: units.reduce((n, u) => n + u.total, 0),
    };
  });
  return { levels, next };
}

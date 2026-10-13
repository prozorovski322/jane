/**
 * State of the learning path: what is done, what is next. Every lesson is open (a learner may
 * start anywhere); "next" is simply the first unfinished lesson in course order. Module tests and
 * level exams are open too once the units they cover are written; they never block anything.
 */
import type { CourseOutline, LevelOutline } from '@/core/content/bundle-types';
import type { Level } from '@/core/content/schema';

import { isLevelReady, isModuleReady, levelExamId, moduleTestId } from '../exams/exam';

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

/** A module test or a level exam: `soon` while some units of its scope are still to be written. */
export interface ExamNode {
  id: string;
  kind: 'module' | 'level';
  status: 'done' | 'open' | 'soon';
}

export interface PathModule {
  id: string;
  order: number;
  title: { en: string; ru: string };
  units: PathUnit[];
  planned: { id: string; title: { en: string; ru: string } }[];
  test: ExamNode;
}

export interface PathLevel {
  level: Level;
  title: string;
  info: Pick<LevelOutline, 'description' | 'canDo' | 'vocabTarget' | 'grammarScope' | 'functions'>;
  modules: PathModule[];
  /** All written units of the level in order (the modules' units, flattened). */
  units: PathUnit[];
  exam: ExamNode;
  /** Lessons and unit tests of written units. */
  done: number;
  total: number;
}

export interface PathState {
  levels: PathLevel[];
  next: { node: PathNode; unitId: string } | null;
}

function examStatus(
  id: string,
  ready: boolean,
  completed: ReadonlySet<string>,
): ExamNode['status'] {
  if (completed.has(id)) return 'done';
  return ready ? 'open' : 'soon';
}

export function pathState(course: CourseOutline, completed: ReadonlySet<string>): PathState {
  let next: PathState['next'] = null;
  const levels = course.levels.map((l): PathLevel => {
    const modules = l.modules.map((m): PathModule => {
      const units = m.units.map((u): PathUnit => {
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
      const testId = moduleTestId(m.id);
      return {
        id: m.id,
        order: m.order,
        title: m.title,
        units,
        planned: m.planned,
        test: {
          id: testId,
          kind: 'module',
          status: examStatus(testId, isModuleReady(m), completed),
        },
      };
    });
    const units = modules.flatMap((m) => m.units);
    const examId = levelExamId(l.level);
    return {
      level: l.level,
      title: l.title,
      info: {
        description: l.description,
        canDo: l.canDo,
        vocabTarget: l.vocabTarget,
        grammarScope: l.grammarScope,
        functions: l.functions,
      },
      modules,
      units,
      exam: { id: examId, kind: 'level', status: examStatus(examId, isLevelReady(l), completed) },
      done: units.reduce((n, u) => n + u.done, 0),
      total: units.reduce((n, u) => n + u.total, 0),
    };
  });
  return { levels, next };
}

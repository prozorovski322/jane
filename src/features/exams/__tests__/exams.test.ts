import * as content from '@/core/content';
import type { CourseOutline } from '@/core/content/bundle-types';
import { getCourse, getUnit } from '@/core/content';
import { exportSnapshot } from '@/core/storage/backup';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import type { LessonSummary } from '@/features/lesson/engine';

import {
  awardExamCertificate,
  creditLevelsBelow,
  loadCertificates,
} from '../../certificates/service';
import { pathState } from '../../path/state';
import { recordSession } from '../../progress/service';
import {
  isExamId,
  isLevelReady,
  isModuleReady,
  LEVEL_EXAM,
  levelExamId,
  MODULE_TEST,
  moduleTestId,
  parseExamId,
  selectExercises,
  sessionForExam,
} from '../exam';

describe('exam ids', () => {
  it('tell module tests and level exams from lessons and unit tests', () => {
    expect(parseExamId('a1.m2.test')).toEqual({ kind: 'module', moduleId: 'a1.m2', level: 'A1' });
    expect(parseExamId('pa1.m1.test')).toEqual({
      kind: 'module',
      moduleId: 'pa1.m1',
      level: 'PA1',
    });
    expect(parseExamId('b2.exam')).toEqual({ kind: 'level', level: 'B2' });
    for (const id of [
      'a1.u01.l01',
      'a1.u01.test',
      'review',
      'practice.words',
      'z9.exam',
      'a1.m.test',
    ])
      expect(isExamId(id)).toBe(false);
  });

  it('are built from module and level', () => {
    expect(moduleTestId('a1.m1')).toBe('a1.m1.test');
    expect(levelExamId('PA1')).toBe('pa1.exam');
  });
});

describe('selectExercises', () => {
  const pool = getUnit('a1.u01').lessons.flatMap((l) => l.exercises);

  it('is deterministic for a seed and varies with it', () => {
    const a = selectExercises(pool, 20, 'x').map((e) => e.id);
    expect(selectExercises(pool, 20, 'x').map((e) => e.id)).toEqual(a);
    expect(selectExercises(pool, 20, 'y').map((e) => e.id)).not.toEqual(a);
  });

  it('returns the requested size without duplicates, mixing skills', () => {
    const picked = selectExercises(pool, 20, 'x');
    expect(picked).toHaveLength(20);
    expect(new Set(picked.map((e) => e.id)).size).toBe(20);
    expect(new Set(picked.map((e) => e.type)).size).toBeGreaterThan(4);
  });

  it('uses everything when the pool is smaller than the test', () => {
    expect(selectExercises(pool.slice(0, 7), 50, 'x')).toHaveLength(7);
  });
});

/** A course in which a1.m1 consists of the written unit a1.u01 only, so its test is available. */
function readyCourse(): CourseOutline {
  const course = getCourse();
  return {
    ...course,
    levels: course.levels.map((l) =>
      l.level === 'A1'
        ? {
            ...l,
            modules: l.modules.map((m, i) => (i === 0 ? { ...m, planned: [] } : m)),
          }
        : l,
    ),
  };
}

describe('sessionForExam', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is not available while units of the module are still to be written', () => {
    expect(sessionForExam('a1.m1.test', 's')).toBeNull();
    expect(sessionForExam('a1.exam', 's')).toBeNull();
    expect(sessionForExam('a1.u01.l01', 's')).toBeNull();
  });

  it("builds a module test from the module's units once they are all written", () => {
    jest.spyOn(content, 'getCourse').mockReturnValue(readyCourse());
    const session = sessionForExam('a1.m1.test', 's')!;
    expect(session).toMatchObject({
      id: 'a1.m1.test',
      kind: 'test',
      unitId: 'a1.m1',
      passScore: MODULE_TEST.passScore,
    });
    expect(session.exercises).toHaveLength(MODULE_TEST.size);
    expect(session.title).toMatch(/^Контрольная:/);
    // Reading and listening exercises find their texts.
    expect(session.texts.length).toBeGreaterThan(0);
  });

  it('readiness follows the planned units', () => {
    const level = getCourse().levels.find((l) => l.level === 'A1')!;
    expect(isModuleReady(level.modules[0]!)).toBe(false);
    expect(isLevelReady(level)).toBe(false);
    const ready = readyCourse().levels.find((l) => l.level === 'A1')!;
    expect(isModuleReady(ready.modules[0]!)).toBe(true);
    expect(isLevelReady(ready)).toBe(false);
  });

  it('exam constants match the course plan', () => {
    expect(LEVEL_EXAM).toEqual({ size: 50, passScore: 0.75 });
  });
});

describe('path with modules and exams', () => {
  it('lists modules, planned units and exam nodes without blocking anything', () => {
    const a1 = pathState(getCourse(), new Set()).levels.find((l) => l.level === 'A1')!;
    expect(a1.modules.map((m) => m.title.ru)).toEqual([
      'Я и другие',
      'Дом и день',
      'Город',
      'Здесь и сейчас',
    ]);
    expect(a1.modules[0]!.units.map((u) => u.id)).toEqual(['a1.u01']);
    expect(a1.modules[0]!.planned.map((p) => p.id)).toEqual(['a1.u02', 'a1.u03']);
    expect(a1.modules[0]!.test).toEqual({ id: 'a1.m1.test', kind: 'module', status: 'soon' });
    expect(a1.exam).toEqual({ id: 'a1.exam', kind: 'level', status: 'soon' });
  });

  it('marks passed tests and keeps the next lesson in the first written unit', () => {
    const s = pathState(getCourse(), new Set(['a1.m1.test', 'a1.exam']));
    const a1 = s.levels.find((l) => l.level === 'A1')!;
    expect(a1.modules[0]!.test.status).toBe('done');
    expect(a1.exam.status).toBe('done');
    expect(s.next?.node.id).toBe('a1.u01.l01');
  });

  it('knows the pre-A1 level, which has no written units yet', () => {
    const pa1 = pathState(getCourse(), new Set()).levels[0]!;
    expect(pa1.level).toBe('PA1');
    expect(pa1.modules).toHaveLength(3);
    expect(pa1.units).toEqual([]);
  });
});

const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

function summary(score: number): LessonSummary {
  const n = 10;
  const correct = Math.round(score * n);
  return {
    lessonId: 'x',
    total: n,
    answered: n,
    skipped: 0,
    correctFirstTry: correct,
    accuracy: score,
    score,
    durationMs: 60_000,
    outcomes: Array.from({ length: n }, (_, i) => ({
      exerciseId: `a1.u01.l01.e0${(i % 2) + 1}`,
      correct: i < correct,
      score: i < correct ? 1 : 0,
      usedHint: false,
      words: [],
      grammar: [],
      troubles: [],
      skill: 'vocabulary' as const,
    })),
  };
}

describe('certificates', () => {
  let db: Db;
  beforeEach(async () => {
    db = openNodeDb();
    await migrate(db);
  });
  afterEach(() => db.close());

  const exam = { id: 'a1.exam', unitId: 'a1', kind: 'test', passScore: 0.75 } as const;

  it('are earned by passing the level exam and not by failing it', async () => {
    const failed = await recordSession(db, exam, summary(0.6), { now: at('2026-10-13') });
    expect(failed.passed).toBe(false);
    expect(failed.certificate).toBeNull();
    expect(await loadCertificates(db)).toEqual([]);

    const passed = await recordSession(db, exam, summary(0.9), { now: at('2026-10-14') });
    expect(passed.certificate).toBe('A1');
    expect(await loadCertificates(db)).toEqual([
      { level: 'A1', earnedAt: at('2026-10-14').getTime(), score: 0.9, source: 'exam' },
    ]);
    // The exam is saved as a passed test with the level as its unit.
    expect(
      await db.get('SELECT unit_id FROM lesson_progress WHERE lesson_id = ? AND passed = 1', [
        'a1.exam',
      ]),
    ).toEqual({ unit_id: 'a1' });
  });

  it('keep the best exam score and the first date', async () => {
    await recordSession(db, exam, summary(0.8), { now: at('2026-10-13') });
    await recordSession(db, exam, summary(0.95), { now: at('2026-10-20') });
    await recordSession(db, exam, summary(0.78), { now: at('2026-10-21') });
    expect(await loadCertificates(db)).toEqual([
      { level: 'A1', earnedAt: at('2026-10-13').getTime(), score: 0.95, source: 'exam' },
    ]);
  });

  it('a module test is saved as passed and gives no certificate', async () => {
    const info = await recordSession(
      db,
      { id: 'a1.m1.test', unitId: 'a1.m1', kind: 'test', passScore: 0.7 },
      summary(0.8),
      { now: at('2026-10-13') },
    );
    expect(info.passed).toBe(true);
    expect(info.certificate).toBeNull();
    expect(await loadCertificates(db)).toEqual([]);
    expect(
      await db.get('SELECT passed FROM lesson_progress WHERE lesson_id = ?', ['a1.m1.test']),
    ).toEqual({ passed: 1 });
  });

  it('are credited by the placement test for lower levels, without overriding an exam', async () => {
    await awardExamCertificate(db, 'A1', 0.9, at('2026-10-13'));
    await creditLevelsBelow(db, 'B1', at('2026-10-14'));
    const certs = await loadCertificates(db);
    expect(certs.map((c) => [c.level, c.source])).toEqual([
      ['PA1', 'placement'],
      ['A1', 'exam'],
      ['A2', 'placement'],
    ]);
    // A later exam replaces a placement credit.
    await awardExamCertificate(db, 'A2', 0.8, at('2026-10-15'));
    expect((await loadCertificates(db)).find((c) => c.level === 'A2')).toMatchObject({
      source: 'exam',
      score: 0.8,
    });
  });

  it('are part of the backup', async () => {
    await awardExamCertificate(db, 'A1', 0.9, at('2026-10-13'));
    expect((await exportSnapshot(db)).tables.certificates).toHaveLength(1);
  });
});

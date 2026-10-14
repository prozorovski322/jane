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
import { isTrackOpen, pathState } from '../../path/state';
import { recordSession } from '../../progress/service';
import {
  isExamId,
  isLevelReady,
  isModuleReady,
  isTrackReady,
  LEVEL_EXAM,
  levelExamId,
  MODULE_TEST,
  moduleTestId,
  parseExamId,
  selectExercises,
  sessionForExam,
  TRACK_TEST,
  trackTestId,
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

/** The real course with an unwritten unit added to the first A1 module, so its test is not ready. */
function courseWithUnwrittenUnit(): CourseOutline {
  const course = getCourse();
  return {
    ...course,
    levels: course.levels.map((l) =>
      l.level === 'A1'
        ? {
            ...l,
            modules: l.modules.map((m, i) =>
              i === 0
                ? { ...m, planned: [{ id: 'a1.u99', title: { en: 'Soon', ru: 'Скоро' } }] }
                : m,
            ),
          }
        : l,
    ),
  };
}

describe('sessionForExam', () => {
  afterEach(() => jest.restoreAllMocks());

  it('builds a module test from the units of a finished module', () => {
    const module = getCourse().levels.find((l) => l.level === 'A1')!.modules[0]!;
    expect(isModuleReady(module)).toBe(true);
    const session = sessionForExam('a1.m1.test', 's')!;
    expect(session).toMatchObject({
      id: 'a1.m1.test',
      kind: 'test',
      unitId: 'a1.m1',
      passScore: MODULE_TEST.passScore,
    });
    expect(session.exercises).toHaveLength(MODULE_TEST.size);
    expect(session.title).toMatch(/^Контрольная:/);
    // Only exercises of the module's own units, with the texts that reading and listening need.
    const unitIds = new Set(module.units.map((u) => u.id));
    for (const ex of session.exercises)
      expect(unitIds.has(ex.id.split('.').slice(0, 2).join('.'))).toBe(true);
    expect(session.texts.length).toBeGreaterThan(0);
  });

  it('builds the A1 level exam from all ten units once the level is written', () => {
    const level = getCourse().levels.find((l) => l.level === 'A1')!;
    expect(isLevelReady(level)).toBe(true);
    const session = sessionForExam('a1.exam', 's')!;
    expect(session).toMatchObject({ id: 'a1.exam', kind: 'test', passScore: LEVEL_EXAM.passScore });
    expect(session.exercises).toHaveLength(LEVEL_EXAM.size);
    const units = new Set(session.exercises.map((e) => e.id.split('.').slice(0, 2).join('.')));
    expect(units.size).toBeGreaterThanOrEqual(8);
  });

  it('builds an exam for every level that is fully written', () => {
    const ready = getCourse().levels.filter((l) => isLevelReady(l));
    expect(ready.map((l) => l.level)).toEqual(expect.arrayContaining(['PA1', 'A1', 'A2']));
    for (const level of ready) {
      const session = sessionForExam(`${level.level.toLowerCase()}.exam`, 's')!;
      expect(session.exercises).toHaveLength(LEVEL_EXAM.size);
    }
  });

  it('builds the test of the second A1 module from its own units', () => {
    const module = getCourse().levels.find((l) => l.level === 'A1')!.modules[1]!;
    expect(isModuleReady(module)).toBe(true);
    const session = sessionForExam('a1.m2.test', 's')!;
    expect(session.exercises).toHaveLength(MODULE_TEST.size);
    const unitIds = new Set(module.units.map((u) => u.id));
    for (const ex of session.exercises)
      expect(unitIds.has(ex.id.split('.').slice(0, 2).join('.'))).toBe(true);
  });

  it('is not available while units of the module are still to be written', () => {
    jest.spyOn(content, 'getCourse').mockReturnValue(courseWithUnwrittenUnit());
    expect(sessionForExam('a1.m1.test', 's')).toBeNull();
    expect(sessionForExam('a1.exam', 's')).toBeNull();
    expect(sessionForExam('a1.u01.l01', 's')).toBeNull();
  });

  it('readiness follows the planned units', () => {
    const level = getCourse().levels.find((l) => l.level === 'A1')!;
    expect(isModuleReady(level.modules[0]!)).toBe(true);
    const unfinished = courseWithUnwrittenUnit().levels.find((l) => l.level === 'A1')!;
    expect(isModuleReady(unfinished.modules[0]!)).toBe(false);
    expect(isLevelReady(unfinished)).toBe(false);
  });

  it('exam constants match the course plan', () => {
    expect(LEVEL_EXAM).toEqual({ size: 50, passScore: 0.75 });
  });
});

describe('path with modules and exams', () => {
  it('lists modules, written and planned units and exam nodes without blocking anything', () => {
    const a1 = pathState(getCourse(), new Set()).levels.find((l) => l.level === 'A1')!;
    expect(a1.modules.map((m) => m.title.ru)).toEqual([
      'Я и другие',
      'Дом и день',
      'Город',
      'Здесь и сейчас',
    ]);
    expect(a1.modules[0]!.units.map((u) => u.id)).toEqual(['a1.u01', 'a1.u02', 'a1.u03']);
    expect(a1.modules[0]!.planned).toEqual([]);
    expect(a1.modules[0]!.test).toEqual({ id: 'a1.m1.test', kind: 'module', status: 'open' });
    // A module opens its test as soon as all its units are written.
    for (const m of a1.modules) {
      expect(m.test.status).toBe(m.planned.length === 0 ? 'open' : 'soon');
    }
    // Modules that are still being written keep the level exam closed.
    const unfinished = a1.modules.some((m) => m.planned.length > 0);
    expect(a1.exam).toEqual({ id: 'a1.exam', kind: 'level', status: unfinished ? 'soon' : 'open' });
  });

  it('marks passed tests and keeps the next lesson in the first written unit', () => {
    const s = pathState(getCourse(), new Set(['a1.m1.test', 'a1.exam']));
    const a1 = s.levels.find((l) => l.level === 'A1')!;
    expect(a1.modules[0]!.test.status).toBe('done');
    expect(a1.exam.status).toBe('done');
    expect(s.next?.node.id).toBe('pa1.u01.l01');
  });

  it('knows the pre-A1 level: three modules, six units, all tests and the exam available', () => {
    const pa1 = pathState(getCourse(), new Set()).levels[0]!;
    expect(pa1.level).toBe('PA1');
    expect(pa1.modules).toHaveLength(3);
    expect(pa1.units.map((u) => u.id)).toEqual([
      'pa1.u01',
      'pa1.u02',
      'pa1.u03',
      'pa1.u04',
      'pa1.u05',
      'pa1.u06',
    ]);
    expect(pa1.modules.map((m) => m.test.status)).toEqual(['open', 'open', 'open']);
    expect(pa1.exam).toEqual({ id: 'pa1.exam', kind: 'level', status: 'open' });
  });
});

describe('tracks', () => {
  it('have their own final test id that never counts as a level exam', () => {
    expect(trackTestId('travel')).toBe('travel.exam');
    expect(parseExamId('travel.exam')).toEqual({ kind: 'track', trackId: 'travel' });
    expect(isExamId('nowhere.exam')).toBe(false);
  });

  it('keep the final test closed while units are still planned', () => {
    const travel = getCourse().tracks.find((t) => t.id === 'travel')!;
    expect(isTrackReady(travel)).toBe(travel.planned.length === 0);
    if (!isTrackReady(travel)) expect(sessionForExam('travel.exam', 's')).toBeNull();
  });

  it('assemble the final test from the track units once they are all written', () => {
    const travel = getCourse().tracks.find((t) => t.id === 'travel')!;
    const done: CourseOutline = {
      ...getCourse(),
      tracks: [{ ...travel, planned: [] }],
    };
    jest.spyOn(content, 'getCourse').mockReturnValue(done);
    try {
      const session = sessionForExam('travel.exam', 's')!;
      expect(session.passScore).toBe(TRACK_TEST.passScore);
      expect(session.exercises.length).toBeLessThanOrEqual(TRACK_TEST.size);
      const own = new Set(
        travel.units.flatMap((u) =>
          getUnit(u.id).lessons.flatMap((l) => l.exercises.map((e) => e.id)),
        ),
      );
      for (const ex of session.exercises) expect(ex.id.startsWith('travel.')).toBe(true);
      expect(session.exercises.some((e) => own.has(e.id))).toBe(true);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('show on the path apart from the levels and never become the next step', () => {
    const s = pathState(getCourse(), new Set());
    const travel = s.tracks.find((t) => t.id === 'travel')!;
    expect(travel.requires).toBe('B1');
    expect(travel.units[0]!.id).toBe('travel.u01');
    expect(travel.units[0]!.nodes.every((n) => n.status === 'open')).toBe(true);
    expect(s.next?.unitId.startsWith('travel')).toBe(false);
  });

  it('open with a certificate of the required level or any higher one', () => {
    expect(isTrackOpen('B1', [])).toBe(false);
    expect(isTrackOpen('B1', ['A1', 'A2'])).toBe(false);
    expect(isTrackOpen('B1', ['B1'])).toBe(true);
    expect(isTrackOpen('B1', ['C1'])).toBe(true);
    expect(isTrackOpen('B2', ['B1'])).toBe(false);
  });

  it('do not award a certificate when the final test is passed', async () => {
    const db = openNodeDb();
    await migrate(db);
    const info = await recordSession(
      db,
      { id: 'travel.exam', kind: 'test', unitId: 'travel', passScore: 0.75 },
      summary(0.9),
      { now: new Date('2026-10-14T10:00:00Z') },
    );
    expect(info.passed).toBe(true);
    expect(info.certificate).toBeNull();
    expect(await loadCertificates(db)).toEqual([]);
    db.close();
  });
});

describe('pre-A1 module tests and exam', () => {
  it('build a module test from its two units', () => {
    const session = sessionForExam('pa1.m2.test', 's')!;
    expect(session.exercises).toHaveLength(MODULE_TEST.size);
    expect(session.unitId).toBe('pa1.m2');
    // Only exercises of the module's units (pa1.u03 and pa1.u04) appear.
    for (const ex of session.exercises) expect(ex.id).toMatch(/^pa1\.u0[34]\./);
  });

  it('build the level exam from all six units, with texts for reading and listening', () => {
    const session = sessionForExam('pa1.exam', 's')!;
    expect(session.exercises).toHaveLength(LEVEL_EXAM.size);
    expect(session.title).toBe('Экзамен уровня Pre-A1');
    const units = new Set(session.exercises.map((e) => e.id.split('.').slice(0, 2).join('.')));
    expect(units.size).toBeGreaterThanOrEqual(5);
    expect(session.texts.length).toBe(12);
    expect(session.passScore).toBe(LEVEL_EXAM.passScore);
  });

  it('differ between attempts', () => {
    const a = sessionForExam('pa1.exam', 'one')!.exercises.map((e) => e.id);
    const b = sessionForExam('pa1.exam', 'two')!.exercises.map((e) => e.id);
    expect(a).not.toEqual(b);
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

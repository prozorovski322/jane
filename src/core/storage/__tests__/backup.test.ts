import { createScheduler } from '@/core/srs/scheduler';
import { recordSession } from '@/features/progress/service';
import type { LessonSummary } from '@/features/lesson/engine';

import { BackupError, exportSnapshot, importSnapshot, parseSnapshot, wipeData } from '../backup';
import type { Db } from '../db';
import { migrate } from '../migrations';
import { openNodeDb } from '../node-db';
import { localSyncProvider } from '../sync';

const summary: LessonSummary = {
  lessonId: 'a1.u01.l01',
  total: 1,
  answered: 1,
  skipped: 0,
  correctFirstTry: 1,
  accuracy: 1,
  score: 1,
  durationMs: 60_000,
  outcomes: [
    {
      exerciseId: 'x',
      correct: true,
      score: 1,
      usedHint: false,
      words: ['hello'],
      grammar: [],
      troubles: [],
      skill: 'vocabulary',
    },
  ],
};

async function freshDb(): Promise<Db> {
  const db = openNodeDb();
  await migrate(db);
  return db;
}

describe('backup', () => {
  it('round-trips all learner data through JSON', async () => {
    const a = await freshDb();
    await recordSession(a, { id: 'a1.u01.l01', unitId: 'a1.u01', kind: 'lesson' }, summary, {
      now: new Date('2026-10-13T10:00:00'),
      scheduler: createScheduler({ fuzz: false }),
    });
    const snap = await exportSnapshot(a, new Date('2026-10-13T11:00:00'));
    const json = JSON.stringify(snap);

    const b = await freshDb();
    await importSnapshot(b, parseSnapshot(json));
    const again = await exportSnapshot(b, new Date('2026-10-13T11:00:00'));
    expect(again).toEqual(snap);
    expect(snap.tables.srs_cards).toHaveLength(1);
    expect(snap.tables.attempts).toHaveLength(1);
  });

  it('rejects files that are not Jane backups', () => {
    expect(() => parseSnapshot('not json')).toThrow(BackupError);
    expect(() => parseSnapshot('{"app":"other"}')).toThrow(/не похож/);
    expect(() =>
      parseSnapshot(
        JSON.stringify({
          app: 'jane',
          schema: 99,
          exportedAt: '',
          tables: Object.fromEntries(
            [
              'kv',
              'lesson_results',
              'attempts',
              'lesson_progress',
              'daily_activity',
              'streak_freezes',
              'srs_cards',
              'srs_log',
            ].map((t) => [t, []]),
          ),
        }),
      ),
    ).toThrow(/более новой версии/);
  });

  it('leaves the database untouched when an import fails halfway', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO kv (key, value) VALUES ('keep', '1')");
    const snap = await exportSnapshot(db);
    // A row that violates the schema (NOT NULL) makes the import fail after the deletes.
    snap.tables.daily_activity.push({ day: null, xp: 1 });
    await expect(importSnapshot(db, snap)).rejects.toThrow();
    expect(await db.get("SELECT value FROM kv WHERE key = 'keep'")).toEqual({ value: '1' });
  });

  it('wipes everything', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO kv (key, value) VALUES ('x', '1')");
    await wipeData(db);
    expect(await db.get('SELECT COUNT(*) AS n FROM kv')).toEqual({ n: 0 });
  });

  it('the local sync provider keeps data as it is', async () => {
    const db = await freshDb();
    const snap = await exportSnapshot(db);
    expect(await localSyncProvider.sync(snap)).toBe(snap);
    expect(await localSyncProvider.status()).toEqual({ connected: false, lastSyncedAt: null });
  });
});

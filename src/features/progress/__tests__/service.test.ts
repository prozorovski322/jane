import { createScheduler, Rating, State } from '@/core/srs/scheduler';
import type { Db } from '@/core/storage/db';
import { migrate, schemaVersion, SCHEMA_VERSION } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import { dueCards, getCards } from '@/core/storage/srs-repo';

import type { LessonSummary } from '../../lesson/engine';
import {
  loadProgress,
  prepareDay,
  recordSession,
  setDailyMinutes,
  type SessionMeta,
} from '../service';

const scheduler = createScheduler({ fuzz: false });
const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

function summary(
  outcomes: {
    correct: boolean;
    words?: string[];
    grammar?: string[];
    usedHint?: boolean;
    score?: number;
  }[],
): LessonSummary {
  const full = outcomes.map((o, i) => ({
    exerciseId: `x.${i}`,
    correct: o.correct,
    score: o.score ?? (o.correct ? 1 : 0),
    usedHint: o.usedHint ?? false,
    words: o.words ?? [],
    grammar: o.grammar ?? [],
    troubles: [],
    skill: 'vocabulary' as const,
  }));
  const correct = full.filter((o) => o.correct).length;
  return {
    lessonId: 'a1.u01.l01',
    total: full.length,
    answered: full.length,
    skipped: 0,
    correctFirstTry: correct,
    accuracy: full.length ? correct / full.length : 0,
    score: full.length ? full.reduce((s, o) => s + o.score, 0) / full.length : 0,
    durationMs: 120_000,
    outcomes: full,
  };
}

const lesson: SessionMeta = { id: 'a1.u01.l01', unitId: 'a1.u01', kind: 'lesson' };
let db: Db;

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('migrations', () => {
  it('bring an empty database to the latest schema and are idempotent', async () => {
    expect(await schemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'attempts',
        'daily_activity',
        'kv',
        'lesson_progress',
        'lesson_results',
        'srs_cards',
        'srs_log',
        'streak_freezes',
      ]),
    );
  });

  it('refuse a database from a newer app', async () => {
    await db.exec('PRAGMA user_version = 999');
    await expect(migrate(db)).rejects.toThrow(/newer than this app/);
  });

  it('roll back a failed migration completely', async () => {
    const fresh = openNodeDb();
    await expect(
      migrate(fresh, [
        { version: 1, sql: 'CREATE TABLE a (x INTEGER); CREATE TABLE a (x INTEGER);' },
      ]),
    ).rejects.toThrow();
    expect(await schemaVersion(fresh)).toBe(0);
    expect(await fresh.all("SELECT name FROM sqlite_master WHERE name = 'a'")).toEqual([]);
    await fresh.close();
  });
});

describe('recordSession', () => {
  it('stores the result, attempts, lesson progress, XP and daily activity', async () => {
    const info = await recordSession(
      db,
      lesson,
      summary([
        { correct: true, words: ['hello'] },
        { correct: false, words: ['bye'] },
      ]),
      { now: at('2026-10-13'), scheduler },
    );
    expect(info).toMatchObject({
      xp: 11,
      totalXp: 11,
      todayXp: 11,
      goalXp: 20,
      streak: 1,
      streakExtended: true,
      passed: true,
    });
    expect(await db.get('SELECT lesson_id, times, passed FROM lesson_progress')).toEqual({
      lesson_id: 'a1.u01.l01',
      times: 1,
      passed: 1,
    });
    expect(await db.get('SELECT COUNT(*) AS n FROM attempts')).toEqual({ n: 2 });
    expect(await db.get('SELECT xp, lessons, seconds FROM daily_activity')).toEqual({
      xp: 11,
      lessons: 1,
      seconds: 120,
    });
  });

  it('reports when the daily goal is reached', async () => {
    await setDailyMinutes(db, 5); // goal 10 XP
    const s = summary([{ correct: true }]);
    const first = await recordSession(db, lesson, s, { now: at('2026-10-13', 9), scheduler });
    expect(first.goalJustReached).toBe(true);
    const second = await recordSession(db, lesson, s, { now: at('2026-10-13', 11), scheduler });
    expect(second.goalJustReached).toBe(false);
    expect(second.todayXp).toBe(first.todayXp + second.xp + second.bonusXp);
  });

  it('creates cards and schedules them by how well the learner answered', async () => {
    const now = at('2026-10-13');
    await recordSession(
      db,
      lesson,
      summary([
        { correct: true, words: ['hello'], grammar: ['a1.be-present'] },
        { correct: true, words: ['bye'], usedHint: true },
        { correct: false, words: ['sorry'] },
        // The same word answered right and wrong: the weaker answer decides.
        { correct: true, words: ['please'] },
        { correct: false, words: ['please'] },
      ]),
      { now, scheduler },
    );
    const cards = await getCards(db, [
      'word:hello',
      'word:bye',
      'word:sorry',
      'word:please',
      'grammar:a1.be-present',
    ]);
    expect(cards.size).toBe(5);
    const due = (id: string) => cards.get(id)!.due.getTime();
    expect(due('word:sorry')).toBeLessThan(due('word:bye'));
    expect(due('word:bye')).toBeLessThanOrEqual(due('word:hello'));
    expect(due('word:please')).toBe(due('word:sorry'));
    const log = await db.all<{ card_id: string; rating: number }>(
      'SELECT card_id, rating FROM srs_log ORDER BY card_id',
    );
    expect(log).toEqual(
      expect.arrayContaining([
        { card_id: 'word:hello', rating: Rating.Good },
        { card_id: 'word:bye', rating: Rating.Hard },
        { card_id: 'word:sorry', rating: Rating.Again },
        { card_id: 'word:please', rating: Rating.Again },
      ]),
    );
  });

  it('moves a card into long-term review after repeated success', async () => {
    let now = at('2026-10-13');
    for (let i = 0; i < 4; i++) {
      await recordSession(
        db,
        { id: 'review', unitId: null, kind: 'review' },
        summary([{ correct: true, words: ['hello'] }]),
        {
          now,
          scheduler,
        },
      );
      const card = (await getCards(db, ['word:hello'])).get('word:hello')!;
      now = new Date(card.due.getTime() + 60_000);
    }
    const card = (await getCards(db, ['word:hello'])).get('word:hello')!;
    expect(card.state).toBe(State.Review);
    expect(card.reps).toBe(4);
    expect(card.scheduled_days).toBeGreaterThan(3);
    expect(await dueCards(db, at('2026-10-13', 11))).toEqual([]);
  });

  it('passes a unit test only with enough score', async () => {
    const test: SessionMeta = { id: 'a1.u01.test', unitId: 'a1.u01', kind: 'test', passScore: 0.8 };
    const failed = await recordSession(db, test, summary([{ correct: true }, { correct: false }]), {
      now: at('2026-10-13'),
      scheduler,
    });
    expect(failed.passed).toBe(false);
    expect((await loadProgress(db, at('2026-10-13'))).completedLessons.has('a1.u01.test')).toBe(
      false,
    );
    const ok = await recordSession(db, test, summary([{ correct: true }, { correct: true }]), {
      now: at('2026-10-13', 12),
      scheduler,
    });
    expect(ok.passed).toBe(true);
    expect((await loadProgress(db, at('2026-10-13', 12))).completedLessons.has('a1.u01.test')).toBe(
      true,
    );
  });

  it('rolls everything back when a write fails', async () => {
    const bad = summary([{ correct: true, words: ['hello'] }]);
    // An outcome that cannot be stored (score must be a number) aborts the whole session.
    (bad.outcomes[0] as { score: unknown }).score = undefined;
    await expect(
      recordSession(db, lesson, bad, { now: at('2026-10-13'), scheduler }),
    ).rejects.toThrow();
    expect(await db.get('SELECT COUNT(*) AS n FROM lesson_results')).toEqual({ n: 0 });
    expect(await db.get('SELECT COUNT(*) AS n FROM srs_cards')).toEqual({ n: 0 });
  });
});

describe('streak over several days', () => {
  const learn = (day: string) =>
    recordSession(db, lesson, summary([{ correct: true }]), { now: at(day), scheduler });

  it('grows day by day and a missed day is covered by a freeze', async () => {
    await learn('2026-10-10');
    await learn('2026-10-11');
    // 12th missed; on the 13th a freeze covers it.
    const info = await learn('2026-10-13');
    expect(info.streak).toBe(3);
    expect(info.freezes).toBe(1);
    expect(await db.all('SELECT day FROM streak_freezes')).toEqual([{ day: '2026-10-12' }]);
  });

  it('starts over after a long break and keeps the freezes', async () => {
    await learn('2026-10-01');
    const info = await learn('2026-10-13');
    expect(info.streak).toBe(1);
    expect(info.freezes).toBe(2);
  });

  it('earns a freeze after a week', async () => {
    const s1 = await prepareDay(db, at('2026-10-01'));
    expect(s1.freezes).toBe(2);
    // Use one freeze first so there is room in the stock.
    await learn('2026-10-01');
    await learn('2026-10-03');
    let info = await learn('2026-10-04');
    expect(info.freezes).toBe(1);
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) info = await learn(d);
    expect(info.streak).toBe(7); // 01, 03–08; the 2nd was frozen
    expect(info.freezeEarned).toBe(true);
    expect(info.freezes).toBe(2);
  });

  it('builds a 35-day activity calendar', async () => {
    await learn('2026-10-12');
    const p = await loadProgress(db, at('2026-10-13'));
    expect(p.calendar).toHaveLength(35);
    expect(p.calendar.at(-1)).toEqual({ day: '2026-10-13', xp: 0, frozen: false });
    expect(p.calendar.at(-2)?.xp).toBeGreaterThan(0);
    expect(p.streak).toBe(1);
  });
});

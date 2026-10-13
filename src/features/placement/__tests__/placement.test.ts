import { getCourse } from '@/core/content';
import { loadPlacement } from '@/core/content/generated';
import type { Level } from '@/core/content/schema';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import { mulberry32 } from '@/lib/random';

import { abilityEstimate, forecast } from '../../progress/forecast';
import { applyPlacement, lessonsToCredit, placementHistory } from '../apply';
import {
  answer,
  guessChance,
  isFinished,
  levelOf,
  MAX_ITEMS,
  MIN_ITEMS,
  nextItem,
  pCorrect,
  placementResult,
  startPlacement,
  type PlacementResult,
  type SelfLevel,
} from '../engine';

const bank = loadPlacement().items;

/** A simulated learner of true ability θ who answers per the model, with luck. */
function simulate(trueTheta: number, self: SelfLevel, seed: number) {
  const rnd = mulberry32(seed);
  let s = startPlacement(self);
  for (;;) {
    const item = nextItem(s, bank, `sim-${seed}`);
    if (!item) break;
    const p = pCorrect(trueTheta, item.b, guessChance(item));
    s = answer(s, item, { correct: rnd() < p });
  }
  return s;
}

const ORDER: Level[] = ['A1', 'A2', 'B1', 'B2'];

describe('adaptive placement', () => {
  it.each([
    [-2.0, 'A1'],
    [-0.6, 'A2'],
    [0.4, 'B1'],
    [1.6, 'B2'],
  ] as const)('finds a learner of ability %s near %s', (trueTheta, level) => {
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    const results = seeds.map((seed) => placementResult(simulate(trueTheta, 'unknown', seed)));
    for (const r of results) {
      expect(r.answered).toBeGreaterThanOrEqual(MIN_ITEMS);
      expect(r.answered).toBeLessThanOrEqual(MAX_ITEMS);
      // Never more than one level off.
      expect(Math.abs(ORDER.indexOf(r.level) - ORDER.indexOf(level))).toBeLessThanOrEqual(1);
    }
    const exact = results.filter((r) => r.level === level).length;
    expect(exact).toBeGreaterThanOrEqual(14); // at least 70% exactly right
  });

  it('never asks the same item twice', () => {
    const s = simulate(0.2, 'b1', 7);
    expect(new Set(s.answers.map((a) => a.itemId)).size).toBe(s.answers.length);
  });

  it('counts «Не знаю» as a wrong answer, and guessing right helps less than knowing', () => {
    const start = startPlacement('unknown');
    const item = nextItem(start, bank, 'x')!;
    // A wrong answer and «Не знаю» carry the same information about ability…
    expect(answer(start, item, 'unknown').theta).toBeCloseTo(
      answer(start, item, { correct: false }).theta,
      6,
    );
    // …and a right answer moves the estimate up, but less than it would without guessing.
    const right = answer(start, item, { correct: true });
    expect(right.theta).toBeGreaterThan(start.theta);
    expect(guessChance(item)).toBeCloseTo(1 / 3);
  });

  it('a beginner who knows nothing is placed from zero', () => {
    let s = startPlacement('zero');
    while (!isFinished(s)) s = answer(s, nextItem(s, bank, 'z')!, 'unknown');
    const r = placementResult(s);
    expect(r).toMatchObject({ level: 'PA1', fromZero: true, correct: 0 });
    expect(r.answered).toBe(MIN_ITEMS);
  });

  it('maps ability to levels', () => {
    expect([-3.5, -2.5, -1.0, 0.0, 1.0, 3.0].map(levelOf)).toEqual([
      'PA1',
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
    ]);
  });
});

const result = (patch: Partial<PlacementResult>): PlacementResult => ({
  theta: 0,
  sd: 0.4,
  level: 'A1',
  position: 0,
  fromZero: false,
  answered: 20,
  correct: 10,
  missed: [],
  ...patch,
});

describe('applying the result', () => {
  it('credits every lesson of lower levels and none of the current one at its start', () => {
    const course = getCourse();
    const all = course.levels.flatMap((l) =>
      l.units.flatMap((u) => [...u.lessons.map((x) => x.id), `${u.id}.test`]),
    );
    expect(
      lessonsToCredit(course, result({ level: 'A2', position: 0.1 })).map((l) => l.lessonId),
    ).toEqual(all);
    expect(lessonsToCredit(course, result({ level: 'A1', position: 0.9 }))).toEqual([]);
    expect(lessonsToCredit(course, result({ level: 'B1', fromZero: true }))).toEqual([]);
  });

  it('stores credits and history and never removes earlier progress', async () => {
    const db = openNodeDb();
    await migrate(db);
    await db.run(
      "INSERT INTO lesson_progress (lesson_id, unit_id, first_completed_at, last_completed_at, best_score, passed, times) VALUES ('a1.u01.l01', 'a1.u01', 1, 1, 0.9, 1, 2)",
    );
    const credited = await applyPlacement(
      db,
      getCourse(),
      result({ level: 'A2', theta: -0.5 }),
      new Date('2026-10-13T10:00:00'),
    );
    expect(credited).toBe(7); // 6 other lessons + unit test; lesson 1 was already done
    expect(
      await db.get("SELECT source, times FROM lesson_progress WHERE lesson_id = 'a1.u01.l01'"),
    ).toEqual({ source: 'lesson', times: 2 });
    expect(
      await db.get("SELECT source FROM lesson_progress WHERE lesson_id = 'a1.u01.test'"),
    ).toEqual({ source: 'placement' });
    expect(await applyPlacement(db, getCourse(), result({ level: 'A1' }))).toBe(0);
    expect((await placementHistory(db)).map((h) => h.level)).toEqual(['A2', 'A1']);
    await db.close();
  });
});

describe('forecast', () => {
  const now = new Date('2026-10-13').getTime();

  it('grows with course completion and placement', () => {
    const none = forecast({ placement: null, completion: { A1: 0 }, accuracy: null, now });
    const halfA1 = forecast({ placement: null, completion: { A1: 0.5 }, accuracy: null, now });
    const placedB1 = forecast({
      placement: { theta: 0.5, at: now },
      completion: { A1: 0.5 },
      accuracy: null,
      now,
    });
    expect(none.A2).toBeLessThan(halfA1.A2);
    expect(halfA1.A2).toBeLessThan(placedB1.A2);
    expect(placedB1.A2).toBeGreaterThan(0.9);
    expect(placedB1.B2).toBeLessThan(0.3);
  });

  it('forgets an old placement and weighs accuracy', () => {
    const old = { theta: 1.5, at: now - 400 * 86_400_000 };
    expect(abilityEstimate({ placement: old, completion: {}, accuracy: null, now })).toBe(-3);
    const clean = abilityEstimate({ placement: null, completion: { A1: 1 }, accuracy: 0.95, now });
    const sloppy = abilityEstimate({ placement: null, completion: { A1: 1 }, accuracy: 0.5, now });
    expect(clean).toBeGreaterThan(sloppy);
  });
});

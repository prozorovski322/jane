import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { buildPlan, isDone, todayPlan, type PlanInput } from '../plan';

const lessons = [
  { id: 'a1.u01.l01', title: 'Привет и пока', isTest: false },
  { id: 'a1.u01.l02', title: 'Я, ты, он', isTest: false },
  { id: 'a1.u01.l03', title: 'Как это пишется?', isTest: false },
  { id: 'a1.u01.l04', title: 'Кем вы работаете?', isTest: false },
  { id: 'a1.u01.l05', title: 'Первый день', isTest: false },
  { id: 'a1.u01.l06', title: 'Языковой клуб', isTest: false },
];
const base: PlanInput = {
  minutes: 10,
  dueCount: 0,
  nextLessons: lessons,
  canPractice: { listening: true, speaking: true },
  weak: [],
};
const total = (items: { minutes: number }[]) => items.reduce((n, i) => n + i.minutes, 0);

describe('buildPlan', () => {
  it('fills 10 minutes with two lessons', () => {
    const plan = buildPlan(base);
    expect(plan.map((p) => p.ref)).toEqual(['a1.u01.l01', 'a1.u01.l02']);
  });

  it('puts due reviews first and still includes new material', () => {
    const plan = buildPlan({ ...base, minutes: 5, dueCount: 40 });
    expect(plan.map((p) => p.kind)).toEqual(['review', 'lesson']);
    expect(plan[0]!.minutes).toBe(5);
  });

  it('adds listening and speaking practice from 15 minutes', () => {
    const plan = buildPlan({ ...base, minutes: 15 });
    expect(plan.map((p) => p.ref)).toEqual([
      'a1.u01.l01',
      'practice.listening',
      'practice.speaking',
    ]);
    expect(total(plan)).toBeLessThanOrEqual(15 + 5);
  });

  it('adds weak spots at 30 minutes and fills the rest with lessons', () => {
    const plan = buildPlan({
      ...base,
      minutes: 30,
      dueCount: 6,
      weak: [{ kind: 'trouble', ref: 'articles', label: 'Артикли', attempts: 5, accuracy: 0.4 }],
    });
    expect(plan.map((p) => p.kind)).toEqual([
      'review',
      'lesson',
      'lesson',
      'lesson',
      'practice',
      'practice',
      'practice',
    ]);
    expect(plan.find((p) => p.ref === 'practice.weak')?.subtitle).toBe('Артикли');
    expect(total(plan)).toBeLessThanOrEqual(30);
  });

  it('skips practice the learner has no material for, and works at the end of the course', () => {
    const plan = buildPlan({
      ...base,
      minutes: 15,
      nextLessons: [],
      canPractice: { listening: false, speaking: true },
    });
    expect(plan.map((p) => p.ref)).toEqual(['practice.speaking']);
  });
});

describe('isDone', () => {
  const today = {
    lessons: new Set(['a1.u01.l01']),
    practice: new Set(['practice.listening']),
    reviewed: true,
  };
  it('ticks items by what was done today', () => {
    const plan = buildPlan({ ...base, minutes: 15, dueCount: 3 });
    expect(plan.map((p) => [p.ref, isDone(p, today)])).toEqual([
      ['review', true],
      ['a1.u01.l01', true],
      ['practice.listening', true],
      ['practice.speaking', false],
    ]);
  });
});

describe('todayPlan', () => {
  it('keeps the same plan through the day and rebuilds it the next day or for other minutes', async () => {
    const db = openNodeDb();
    await migrate(db);
    const morning = await todayPlan(db, base, new Date('2026-10-13T08:00:00'));
    // The learner finished lesson 1: the input moves on, the plan of the day does not.
    const evening = await todayPlan(
      db,
      { ...base, nextLessons: lessons.slice(1) },
      new Date('2026-10-13T20:00:00'),
    );
    expect(evening).toEqual(morning);
    const longer = await todayPlan(
      db,
      { ...base, minutes: 30, nextLessons: lessons.slice(1) },
      new Date('2026-10-13T20:00:00'),
    );
    expect(longer[0]!.ref).toBe('a1.u01.l02');
    const tomorrow = await todayPlan(
      db,
      { ...base, nextLessons: lessons.slice(1) },
      new Date('2026-10-14T08:00:00'),
    );
    expect(tomorrow[0]!.ref).toBe('a1.u01.l02');
    await db.close();
  });
});

/**
 * The daily plan: 5, 10, 15 or 30 minutes made of reviews, new lessons, listening and speaking
 * practice and weak spots. Built once per day and stored, so finishing a lesson ticks it off
 * instead of reshuffling the plan.
 */
import { dayOf } from '@/core/progress/dates';
import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';

import { practiceId, type PracticeKind } from '../practice/build';
import type { TodayActivity, WeakSpot } from '../progress/insights';

export type PlanItemKind = 'review' | 'lesson' | 'practice';

export interface PlanItem {
  kind: PlanItemKind;
  /** Lesson id, practice id ("practice.listening") or "review". */
  ref: string;
  title: string;
  subtitle: string;
  minutes: number;
}

export interface PlanInput {
  minutes: number;
  dueCount: number;
  /** Upcoming unfinished lessons in course order. */
  nextLessons: readonly { id: string; title: string; isTest: boolean }[];
  canPractice: { listening: boolean; speaking: boolean };
  weak: readonly WeakSpot[];
}

const LESSON_MINUTES = 5;
const TEST_MINUTES = 6;

function reviewMinutes(due: number): number {
  return Math.min(5, Math.max(2, Math.round(Math.min(due, 15) * 0.3)));
}

function practiceItem(
  kind: PracticeKind,
  title: string,
  subtitle: string,
  minutes: number,
): PlanItem {
  return { kind: 'practice', ref: practiceId({ kind }), title, subtitle, minutes };
}

export function buildPlan(input: PlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  let used = 0;

  if (input.dueCount > 0) {
    const m = reviewMinutes(input.dueCount);
    items.push({
      kind: 'review',
      ref: 'review',
      title: 'Повторение',
      subtitle: `Карточек к повторению: ${input.dueCount}`,
      minutes: m,
    });
    used += m;
  }

  const extras: PlanItem[] = [];
  if (input.minutes >= 15 && input.canPractice.listening) {
    extras.push(practiceItem('listening', 'Аудирование', 'Тренировка на слух', 4));
  }
  if (input.minutes >= 15 && input.canPractice.speaking) {
    extras.push(practiceItem('speaking', 'Говорение', 'Повторить и ответить вслух', 3));
  }
  if (input.minutes >= 30 && input.weak.length) {
    extras.push(practiceItem('weak', 'Слабые места', input.weak[0]!.label, 5));
  }
  const extraMinutes = extras.reduce((n, e) => n + e.minutes, 0);

  // New material: always at least one lesson, then as many as fit next to the practice.
  let lessons = 0;
  for (const l of input.nextLessons) {
    const m = l.isTest ? TEST_MINUTES : LESSON_MINUTES;
    if (lessons > 0 && used + m + extraMinutes > input.minutes) break;
    items.push({
      kind: 'lesson',
      ref: l.id,
      title: l.title,
      subtitle: l.isTest ? 'Итоговый тест юнита' : 'Новый урок',
      minutes: m,
    });
    used += m;
    lessons++;
  }

  return [...items, ...extras];
}

export function isDone(item: PlanItem, today: TodayActivity): boolean {
  switch (item.kind) {
    case 'review':
      return today.reviewed;
    case 'lesson':
      return today.lessons.has(item.ref);
    case 'practice':
      return today.practice.has(item.ref);
  }
}

interface StoredPlan {
  day: string;
  minutes: number;
  items: PlanItem[];
}

const KEY = 'today.plan';

/** Today's plan: the stored one if it was made today for the same minutes, otherwise a new one. */
export async function todayPlan(db: Db, input: PlanInput, now = new Date()): Promise<PlanItem[]> {
  const day = dayOf(now);
  const stored = await kvGet<StoredPlan | null>(db, KEY, null);
  if (stored && stored.day === day && stored.minutes === input.minutes) return stored.items;
  const items = buildPlan(input);
  await kvSet(db, KEY, { day, minutes: input.minutes, items } satisfies StoredPlan);
  return items;
}

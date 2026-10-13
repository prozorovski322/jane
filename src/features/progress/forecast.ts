/**
 * Level forecast: how ready the learner probably is for A2, B1 and B2, from the placement test,
 * the share of each level completed in the course, and recent accuracy. It is an estimate of
 * readiness, not an exam score, and the app says so wherever it is shown.
 */
import { getCourse } from '@/core/content';
import { LEVELS, type Level } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';

import { lastPlacement } from '../placement/apply';
import { LEVEL_FLOOR, levelRange } from '../placement/engine';

export const FORECAST_TARGETS = ['A2', 'B1', 'B2'] as const;
export type ForecastTarget = (typeof FORECAST_TARGETS)[number];

const PLACEMENT_VALID_DAYS = 180;

export interface ForecastInput {
  placement: { theta: number; at: number } | null;
  /** Share of a level's lessons passed (completed or credited); absent if the course has none yet. */
  completion: Partial<Record<Level, number>>;
  /** First-try accuracy over the last 30 days, or null without data. */
  accuracy: number | null;
  now: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function abilityEstimate(input: ForecastInput): number {
  let theta = -3;
  for (const level of LEVELS) {
    const c = input.completion[level];
    if (!c) continue;
    const [lo, hi] = levelRange(level);
    theta = Math.max(theta, lo + c * (hi - lo));
  }
  const p = input.placement;
  if (p && input.now - p.at < PLACEMENT_VALID_DAYS * 86_400_000) theta = Math.max(theta, p.theta);
  if (input.accuracy !== null) {
    // Completing lessons with many mistakes counts for less; very clean work a little more.
    theta += Math.min(0.3, Math.max(-0.5, (input.accuracy - 0.8) * 1.2));
  }
  return theta;
}

/** 0..1: probability-like readiness for a level. */
export function readiness(theta: number, target: ForecastTarget): number {
  return sigmoid((theta - LEVEL_FLOOR[target]) / 0.35);
}

export function forecast(input: ForecastInput): Record<ForecastTarget, number> {
  const theta = abilityEstimate(input);
  return Object.fromEntries(FORECAST_TARGETS.map((t) => [t, readiness(theta, t)])) as Record<
    ForecastTarget,
    number
  >;
}

export async function loadForecast(db: Db, completed: ReadonlySet<string>, now = new Date()) {
  const completion: Partial<Record<Level, number>> = {};
  for (const level of getCourse().levels) {
    const ids = level.units.flatMap((u) => [...u.lessons.map((l) => l.id), `${u.id}.test`]);
    if (ids.length)
      completion[level.level] = ids.filter((id) => completed.has(id)).length / ids.length;
  }
  const since = now.getTime() - 30 * 86_400_000;
  const acc = await db.get<{ n: number; c: number }>(
    'SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS c FROM attempts WHERE at >= ?',
    [since],
  );
  const placement = await lastPlacement(db);
  return forecast({
    placement: placement ? { theta: placement.theta, at: placement.at } : null,
    completion,
    accuracy: acc && acc.n >= 10 ? acc.c / acc.n : null,
    now: now.getTime(),
  });
}

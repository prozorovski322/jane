/**
 * Adaptive placement test (computerized adaptive testing).
 *
 * Model: three-parameter logistic. The chance that a learner of ability θ answers an item of
 * difficulty b correctly is c + (1 − c) / (1 + e^(−a(θ − b))), where c is the chance of a lucky
 * guess (1 / number of options). «Не знаю» is an honest wrong answer: no guessing term.
 *
 * Ability is estimated as the posterior mean (EAP) on a grid, starting from a prior centred on the
 * learner's self-assessment. Each next item is the most informative one at the current estimate
 * (picked at random among the top three, so retakes differ). The test stops after 15 items once
 * the estimate is precise enough, and never runs past 25.
 */
import type { Level, PlacementItem } from '@/core/content/schema';
import { mulberry32, hashString } from '@/lib/random';

export const MIN_ITEMS = 15;
export const MAX_ITEMS = 25;
export const TARGET_SD = 0.45;
const DISCRIMINATION = 1.4;
const PRIOR_SD = 1.2;
const GRID = Array.from({ length: 161 }, (_, i) => -4 + i * 0.05);

/** Self-assessment shown in onboarding, and where the test starts for each answer. */
export const SELF_LEVELS = {
  zero: { label: 'Начинаю с нуля', prior: -3.2 },
  basics: { label: 'Знаю основы', prior: -1.8 },
  a2: { label: 'Могу объясниться в простых ситуациях', prior: -0.6 },
  b1: { label: 'Свободно говорю на бытовые темы', prior: 0.4 },
  b2: { label: 'Уверенно, но хочу подтянуть', prior: 1.4 },
  c1: { label: 'Почти свободно, нужны тонкости', prior: 2.6 },
  unknown: { label: 'Не знаю — определите тестом', prior: -1.0 },
} as const;
export type SelfLevel = keyof typeof SELF_LEVELS;

export interface PlacementAnswer {
  itemId: string;
  level: Level;
  b: number;
  /** Guessing chance of the item (1 / options). */
  c: number;
  correct: boolean;
  /** The learner pressed «Не знаю». */
  unknown: boolean;
}

export interface PlacementState {
  prior: number;
  answers: PlacementAnswer[];
  theta: number;
  sd: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function pCorrect(theta: number, b: number, c: number): number {
  return c + (1 - c) * sigmoid(DISCRIMINATION * (theta - b));
}

function likelihood(theta: number, a: PlacementAnswer): number {
  if (a.unknown) return 1 - sigmoid(DISCRIMINATION * (theta - a.b));
  const p = pCorrect(theta, a.b, a.c);
  return a.correct ? p : 1 - p;
}

/** Posterior mean and standard deviation of ability. */
export function estimate(
  prior: number,
  answers: readonly PlacementAnswer[],
): { theta: number; sd: number } {
  const weights = GRID.map((t) => {
    const z = (t - prior) / PRIOR_SD;
    let w = Math.exp(-0.5 * z * z);
    for (const a of answers) w *= likelihood(t, a);
    return w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  const mean = GRID.reduce((s, t, i) => s + t * weights[i]!, 0) / total;
  const variance = GRID.reduce((s, t, i) => s + (t - mean) ** 2 * weights[i]!, 0) / total;
  return { theta: mean, sd: Math.sqrt(variance) };
}

export function startPlacement(self: SelfLevel): PlacementState {
  const prior = SELF_LEVELS[self].prior;
  return { prior, answers: [], ...estimate(prior, []) };
}

export function guessChance(item: PlacementItem): number {
  const ex = item.exercise;
  const n = ex.type === 'fill_gap' ? (ex.options?.length ?? 3) : ex.options.length;
  return 1 / n;
}

/** Fisher information of a 3PL item at θ. */
function information(theta: number, b: number, c: number): number {
  const p = pCorrect(theta, b, c);
  return DISCRIMINATION ** 2 * ((p - c) ** 2 / (1 - c) ** 2) * ((1 - p) / p);
}

export function isFinished(s: PlacementState): boolean {
  const n = s.answers.length;
  return n >= MAX_ITEMS || (n >= MIN_ITEMS && s.sd <= TARGET_SD);
}

export function nextItem(
  s: PlacementState,
  bank: readonly PlacementItem[],
  seed: string,
): PlacementItem | null {
  if (isFinished(s)) return null;
  const used = new Set(s.answers.map((a) => a.itemId));
  const ranked = bank
    .filter((it) => !used.has(it.exercise.id))
    .map((it) => ({ it, info: information(s.theta, it.b, guessChance(it)) }))
    .sort((x, y) => y.info - x.info);
  if (!ranked.length) return null;
  const rnd = mulberry32(hashString(`${seed}:${s.answers.length}`));
  return ranked[Math.floor(rnd() * Math.min(3, ranked.length))]!.it;
}

export function answer(
  s: PlacementState,
  item: PlacementItem,
  result: { correct: boolean } | 'unknown',
): PlacementState {
  const a: PlacementAnswer = {
    itemId: item.exercise.id,
    level: item.level,
    b: item.b,
    c: guessChance(item),
    correct: result !== 'unknown' && result.correct,
    unknown: result === 'unknown',
  };
  const answers = [...s.answers, a];
  return { ...s, answers, ...estimate(s.prior, answers) };
}

/** Level thresholds on the ability scale (upper bound of each level). */
const UPPER: [Level, number][] = [
  ['PA1', -2.6],
  ['A1', -1.2],
  ['A2', -0.1],
  ['B1', 0.9],
  ['B2', 2.4],
  ['C1', Infinity],
];
/** Where each level starts on the ability scale. */
export const LEVEL_FLOOR: Record<Level, number> = {
  PA1: -4,
  A1: -2.6,
  A2: -1.2,
  B1: -0.1,
  B2: 0.9,
  C1: 2.4,
};
const LOWER = LEVEL_FLOOR;
export const SCALE_TOP = 3.6;
const TOP = SCALE_TOP;

/** [floor, ceiling] of a level on the ability scale. */
export function levelRange(level: Level): [number, number] {
  const hi = UPPER.find(([l]) => l === level)![1];
  return [LEVEL_FLOOR[level], Number.isFinite(hi) ? hi : SCALE_TOP];
}

export interface PlacementResult {
  theta: number;
  sd: number;
  level: Level;
  /** 0..1: how far into the level the learner already is. */
  position: number;
  /** Clearly a beginner: start from the very first lesson. */
  fromZero: boolean;
  answered: number;
  correct: number;
  /** Items answered wrong or «Не знаю», for the review after the test. */
  missed: string[];
}

export function levelOf(theta: number): Level {
  return UPPER.find(([, hi]) => theta < hi)![0];
}

export function placementResult(s: PlacementState): PlacementResult {
  const level = levelOf(s.theta);
  const lo = LOWER[level];
  const upper = UPPER.find(([l]) => l === level)![1];
  const hi = Number.isFinite(upper) ? upper : TOP;
  return {
    theta: s.theta,
    sd: s.sd,
    level,
    position: Math.min(1, Math.max(0, (s.theta - lo) / (hi - lo))),
    fromZero: s.theta < -2.2,
    answered: s.answers.length,
    correct: s.answers.filter((a) => a.correct).length,
    missed: s.answers.filter((a) => !a.correct).map((a) => a.itemId),
  };
}

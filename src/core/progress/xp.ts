/**
 * Experience points. Generous and predictable: XP rewards showing up and answering right on the
 * first try; mistakes never take XP away.
 */

export type SessionKind = 'lesson' | 'test' | 'review' | 'practice';

export interface XpInput {
  kind: SessionKind;
  answered: number;
  correctFirstTry: number;
  accuracy: number;
  passed: boolean;
}

export const XP = {
  lessonBase: 10,
  perCorrect: 1,
  perfectBonus: 5,
  greatBonus: 3,
  testPassBonus: 20,
  reviewCap: 30,
} as const;

export function sessionXp(s: XpInput): number {
  if (s.answered === 0) return 0;
  if (s.kind === 'review') return Math.min(XP.reviewCap, s.correctFirstTry * XP.perCorrect + 2);
  const base = s.kind === 'practice' ? XP.lessonBase / 2 : XP.lessonBase;
  const bonus = s.accuracy === 1 ? XP.perfectBonus : s.accuracy >= 0.9 ? XP.greatBonus : 0;
  const test = s.kind === 'test' && s.passed ? XP.testPassBonus : 0;
  return base + s.correctFirstTry * XP.perCorrect + bonus + test;
}

/** Daily XP goal for the minutes a day the learner chose. */
export function dailyGoalXp(minutes: number): number {
  if (minutes <= 5) return 10;
  if (minutes <= 10) return 20;
  if (minutes <= 15) return 30;
  return 50;
}

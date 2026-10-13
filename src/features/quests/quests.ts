/**
 * Daily quests: three small, optional goals a day on top of the daily XP goal. They are chosen
 * deterministically from the date, stored once for the day (so they do not change as the learner
 * progresses) and rewarded with a little extra XP. Missing a quest costs nothing.
 */
import type { Skill } from '@/core/content/schema';
import { hashString, shuffle } from '@/lib/random';

export type QuestKind = 'xp' | 'lesson' | 'review' | 'practice' | 'accuracy' | 'skill';

export interface Quest {
  id: string;
  kind: QuestKind;
  /** XP, lessons, cards, sessions or answers to reach; for accuracy, the number of answers. */
  target: number;
  skill?: Skill;
  title: string;
  /** Bonus XP when completed. */
  xp: number;
}

/** What the learner did today; progress of every quest is computed from this. */
export interface DayStats {
  xp: number;
  lessons: number;
  reviews: number;
  practice: number;
  /** Highest first-try accuracy of today's sessions with at least 8 answers, or 0. */
  bestAccuracy: number;
  skills: Partial<Record<Skill, number>>;
}

export const QUEST_XP = 5;
export const ALL_QUESTS_BONUS = 10;
export const ACCURACY_GOAL = 0.9;
export const ACCURACY_MIN_ANSWERS = 8;

const SKILL_TITLE: Partial<Record<Skill, (n: number) => string>> = {
  vocabulary: (n) => `Ответьте на ${n} заданий по словам`,
  grammar: (n) => `Ответьте на ${n} заданий по грамматике`,
  listening: (n) => `Ответьте на ${n} заданий на слух`,
  speaking: (n) => `Выполните ${n} задания на говорение`,
};

const SKILL_TARGET: Partial<Record<Skill, number>> = {
  vocabulary: 10,
  grammar: 8,
  listening: 5,
  speaking: 3,
};

export interface QuestOptions {
  /** The learner has cards to review. */
  hasCards: boolean;
  /** The learner has met speaking exercises, so a speaking quest is reachable. */
  canSpeak: boolean;
}

function make(kind: QuestKind, target: number, skill?: Skill): Quest {
  const id = skill ? `${kind}.${skill}` : `${kind}.${target}`;
  const title = {
    xp: `Заработайте ${target} XP`,
    lesson: 'Пройдите урок',
    review: `Повторите ${target} карточек`,
    practice: 'Сделайте тренировку в «Практике»',
    accuracy: `Пройдите занятие точностью ${Math.round(ACCURACY_GOAL * 100)}%`,
    skill: SKILL_TITLE[skill ?? 'vocabulary']?.(target) ?? 'Выполните задания',
  }[kind];
  return { id, kind, target, skill, title, xp: QUEST_XP };
}

/** Three different quests for the day: one about progress, one about a skill, one more. */
export function questsForDay(day: string, opts: QuestOptions): Quest[] {
  const seed = `quests:${day}`;
  const progress = shuffle([make('lesson', 1), make('xp', 20), make('xp', 30)], seed + ':p')[0]!;

  const skills: Skill[] = [
    'vocabulary',
    'grammar',
    'listening',
    ...(opts.canSpeak ? (['speaking'] as const) : []),
  ];
  const skill = shuffle(skills, seed + ':s')[0]!;
  const skillQuest = make('skill', SKILL_TARGET[skill]!, skill);

  const others = [
    make('practice', 1),
    make('accuracy', ACCURACY_MIN_ANSWERS),
    ...(opts.hasCards ? [make('review', 10)] : []),
  ];
  const third = shuffle(others, seed + ':o')[0]!;

  return [progress, skillQuest, third];
}

export function questProgress(q: Quest, s: DayStats): number {
  switch (q.kind) {
    case 'xp':
      return Math.min(q.target, s.xp);
    case 'lesson':
      return Math.min(q.target, s.lessons);
    case 'review':
      return Math.min(q.target, s.reviews);
    case 'practice':
      return Math.min(q.target, s.practice);
    case 'accuracy':
      return s.bestAccuracy >= ACCURACY_GOAL ? q.target : 0;
    case 'skill':
      return Math.min(q.target, s.skills[q.skill!] ?? 0);
  }
}

export const isQuestDone = (q: Quest, s: DayStats) => questProgress(q, s) >= q.target;

/** A stable per-day number for picking among texts. */
export const dayNumber = (day: string) => hashString(day);

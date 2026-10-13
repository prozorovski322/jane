/**
 * Lesson session state machine. Pure: the screen drives it with `useReducer`, tests drive it
 * directly. Rules:
 * - a wrong answer comes back once at the end of the lesson ("ошибки возвращаются в урок");
 * - partially right answers (most questions of a text, pairs with slips) do not come back;
 * - a learner who cannot listen or speak right now may skip such exercises without penalty;
 * - accuracy is measured on first attempts only.
 */
import {
  checkExercise,
  needsRetry,
  type CheckOptions,
  type Response,
  type Verdict,
} from '@/core/scoring/check';
import type { Exercise, Skill, Trouble } from '@/core/content/schema';

export type SkipReason = 'cant-listen' | 'cant-speak';

export interface QueueItem {
  exercise: Exercise;
  /** True for the second chance after a mistake. */
  retry: boolean;
}

export interface ExerciseRecord {
  exerciseId: string;
  first: Verdict | null;
  last: Verdict | null;
  attempts: number;
  skipped: SkipReason | null;
  usedHint: boolean;
}

export interface LessonState {
  lessonId: string;
  queue: QueueItem[];
  position: number;
  phase: 'answering' | 'feedback' | 'done';
  verdict: Verdict | null;
  records: Record<string, ExerciseRecord>;
  startedAt: number;
  finishedAt: number | null;
}

export type LessonAction =
  | { type: 'answer'; response: Response; now?: number }
  | { type: 'hint' }
  | { type: 'skip'; reason: SkipReason; now?: number }
  | { type: 'continue'; now?: number };

export interface BuildOptions {
  /** Exercises the learner has clearly mastered (e.g. easy items on known words) are left out. */
  skip?: (ex: Exercise) => boolean;
  /** Never drop below this many exercises because of `skip`. */
  minExercises?: number;
  now?: number;
}

export function createLesson(
  lessonId: string,
  exercises: readonly Exercise[],
  opts: BuildOptions = {},
): LessonState {
  const min = opts.minExercises ?? 6;
  let chosen = opts.skip ? exercises.filter((e) => !opts.skip!(e)) : [...exercises];
  if (chosen.length < Math.min(min, exercises.length)) {
    // Fill back in original order so the lesson keeps its shape.
    const keep = new Set(chosen.map((e) => e.id));
    for (const e of exercises) {
      if (keep.size >= min) break;
      keep.add(e.id);
    }
    chosen = exercises.filter((e) => keep.has(e.id));
  }
  return {
    lessonId,
    queue: chosen.map((exercise) => ({ exercise, retry: false })),
    position: 0,
    phase: chosen.length ? 'answering' : 'done',
    verdict: null,
    records: Object.fromEntries(
      chosen.map((e) => [
        e.id,
        { exerciseId: e.id, first: null, last: null, attempts: 0, skipped: null, usedHint: false },
      ]),
    ),
    startedAt: opts.now ?? Date.now(),
    finishedAt: chosen.length ? null : (opts.now ?? Date.now()),
  };
}

export function currentItem(state: LessonState): QueueItem | null {
  return state.phase === 'done' ? null : (state.queue[state.position] ?? null);
}

/** 0..1 for the progress bar; retries extend the lesson, so the bar never jumps back. */
export function progress(state: LessonState): number {
  if (state.phase === 'done') return 1;
  const done = state.position + (state.phase === 'feedback' ? 1 : 0);
  return state.queue.length ? done / state.queue.length : 1;
}

const LISTENING = new Set(['listen_choice', 'listen_dictation', 'minimal_pair']);
const SPEAKING = new Set(['speak_repeat', 'speak_answer', 'speak_describe']);

export function canSkip(ex: Exercise, reason: SkipReason): boolean {
  if (reason === 'cant-speak') return SPEAKING.has(ex.type);
  return LISTENING.has(ex.type) || (ex.type === 'comprehension' && ex.mode === 'listening');
}

export function makeReducer(opts: CheckOptions = {}) {
  return function lessonReducer(state: LessonState, action: LessonAction): LessonState {
    const item = currentItem(state);

    switch (action.type) {
      case 'hint': {
        if (!item || state.phase !== 'answering') return state;
        const rec = state.records[item.exercise.id]!;
        return {
          ...state,
          records: { ...state.records, [rec.exerciseId]: { ...rec, usedHint: true } },
        };
      }

      case 'answer': {
        if (!item || state.phase !== 'answering') return state;
        const verdict = checkExercise(item.exercise, action.response, opts);
        const rec = state.records[item.exercise.id]!;
        const records = {
          ...state.records,
          [rec.exerciseId]: {
            ...rec,
            first: rec.first ?? verdict,
            last: verdict,
            attempts: rec.attempts + 1,
          },
        };
        const queue =
          needsRetry(verdict) && !item.retry
            ? [...state.queue, { exercise: item.exercise, retry: true }]
            : state.queue;
        return { ...state, queue, records, verdict, phase: 'feedback' };
      }

      case 'skip': {
        if (!item || state.phase !== 'answering' || !canSkip(item.exercise, action.reason))
          return state;
        const rec = state.records[item.exercise.id]!;
        const records = { ...state.records, [rec.exerciseId]: { ...rec, skipped: action.reason } };
        return advance({ ...state, records }, action.now);
      }

      case 'continue':
        if (state.phase !== 'feedback') return state;
        return advance(state, action.now);
    }
  };
}

function advance(state: LessonState, now = Date.now()): LessonState {
  const position = state.position + 1;
  if (position >= state.queue.length) {
    return { ...state, position, phase: 'done', verdict: null, finishedAt: now };
  }
  return { ...state, position, phase: 'answering', verdict: null };
}

export interface LessonSummary {
  lessonId: string;
  total: number;
  answered: number;
  skipped: number;
  correctFirstTry: number;
  /** Share of answered exercises right on the first try. */
  accuracy: number;
  /** Mean first-attempt score, 0..1. */
  score: number;
  durationMs: number;
  /** First-attempt result per exercise, for the scheduler and weak-spot tracking. */
  outcomes: {
    exerciseId: string;
    correct: boolean;
    score: number;
    usedHint: boolean;
    words: string[];
    grammar: string[];
    troubles: Trouble[];
    skill: Skill;
  }[];
}

/** The skill an exercise trains, for per-skill statistics. */
export function skillOf(ex: Exercise): Skill {
  switch (ex.type) {
    case 'listen_choice':
    case 'listen_dictation':
      return 'listening';
    case 'comprehension':
      return ex.mode;
    case 'speak_repeat':
    case 'speak_answer':
    case 'speak_describe':
      return 'speaking';
    case 'write':
      return 'writing';
    case 'minimal_pair':
    case 'word_stress':
      return 'pronunciation';
    case 'fill_gap':
    case 'error_correction':
      return 'grammar';
    default:
      return ex.grammar.length ? 'grammar' : 'vocabulary';
  }
}

export function summarize(state: LessonState): LessonSummary {
  const unique = new Map<string, Exercise>();
  for (const { exercise } of state.queue) unique.set(exercise.id, exercise);

  const outcomes: LessonSummary['outcomes'] = [];
  let skipped = 0;
  for (const ex of unique.values()) {
    const rec = state.records[ex.id]!;
    if (rec.skipped || !rec.first) {
      skipped++;
      continue;
    }
    outcomes.push({
      exerciseId: ex.id,
      correct: rec.first.correct,
      score: rec.first.score,
      usedHint: rec.usedHint,
      words: ex.words,
      grammar: ex.grammar,
      troubles: ex.troubles,
      skill: skillOf(ex),
    });
  }
  const correctFirstTry = outcomes.filter((o) => o.correct).length;
  return {
    lessonId: state.lessonId,
    total: unique.size,
    answered: outcomes.length,
    skipped,
    correctFirstTry,
    accuracy: outcomes.length ? correctFirstTry / outcomes.length : 0,
    score: outcomes.length ? outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length : 0,
    durationMs: (state.finishedAt ?? state.startedAt) - state.startedAt,
    outcomes,
  };
}

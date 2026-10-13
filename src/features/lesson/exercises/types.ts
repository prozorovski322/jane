import type { LexiconEntry } from '@/core/content/bundle-types';
import type { ExerciseOf, ExerciseType, Text } from '@/core/content/schema';
import type { Response, Verdict } from '@/core/scoring/check';

export interface ExerciseContext {
  word: (id: string) => LexiconEntry | undefined;
  text: (id: string) => Text | undefined;
  /** The learner said they cannot listen right now: show text instead of audio where possible. */
  cantListen: boolean;
}

export interface ExerciseViewProps<T extends ExerciseType = ExerciseType> {
  exercise: ExerciseOf<T>;
  /** Report the current response; `null` while the answer is not complete. */
  onChange: (response: Response | null) => void;
  /** Set once checked: the view shows right/wrong states and becomes read-only. */
  verdict: Verdict | null;
  /** Seed for shuffling options; differs between the first try and the retry. */
  seed: string;
  ctx: ExerciseContext;
}

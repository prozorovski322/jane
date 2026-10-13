import type { ExerciseType } from '@/core/content/schema';

import { FillGapView, ListenDictationView, TilesView, TypeTranslationView } from './BuildExercises';
import {
  ListenChoiceView,
  MinimalPairView,
  PictureChoiceView,
  TranslateChoiceView,
  WordStressView,
} from './ChoiceExercises';
import { ComprehensionView, ErrorCorrectionView, MatchPairsView } from './InteractiveExercises';
import { SpeakView, WriteView } from './ProductionExercises';
import type { ExerciseViewProps } from './types';

type SpeakType = 'speak_repeat' | 'speak_answer' | 'speak_describe';
/** SpeakView handles all three speaking types; TypeScript cannot see that through `Extract`. */
const speak = <T extends SpeakType>() =>
  SpeakView as unknown as (props: ExerciseViewProps<T>) => React.ReactElement;

/** One view per exercise type; the compiler checks that no type is missing. */
export const EXERCISE_VIEWS: {
  [T in ExerciseType]: (props: ExerciseViewProps<T>) => React.ReactElement;
} = {
  translate_choice: TranslateChoiceView,
  picture_choice: PictureChoiceView,
  tiles: TilesView,
  type_translation: TypeTranslationView,
  match_pairs: MatchPairsView,
  fill_gap: FillGapView,
  error_correction: ErrorCorrectionView,
  listen_dictation: ListenDictationView,
  listen_choice: ListenChoiceView,
  comprehension: ComprehensionView,
  speak_repeat: speak<'speak_repeat'>(),
  speak_answer: speak<'speak_answer'>(),
  speak_describe: speak<'speak_describe'>(),
  write: WriteView,
  minimal_pair: MinimalPairView,
  word_stress: WordStressView,
};

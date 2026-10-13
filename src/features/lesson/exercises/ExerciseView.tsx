import { EXERCISE_VIEWS } from './registry';
import type { ExerciseViewProps } from './types';

/** Renders any exercise by type. Keyed by the caller so state resets between exercises. */
export function ExerciseView(props: ExerciseViewProps) {
  const Component = EXERCISE_VIEWS[props.exercise.type] as (
    p: ExerciseViewProps,
  ) => React.ReactElement;
  return <Component {...props} />;
}

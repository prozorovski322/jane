import { Exercise } from '@/core/content/schema';
import { checkExercise } from '@/core/scoring/check';
import { STUDY_SCENARIOS, studySession } from '../content';

it.each(STUDY_SCENARIOS)(
  'runs the complete $id scenario with valid exercises and usable sample answers',
  (scenario) => {
    const session = studySession(scenario.id)!;
    expect(session.exercises).toHaveLength(10);
    expect(new Set(session.exercises.map((e) => e.id)).size).toBe(10);
    for (const exercise of session.exercises) {
      expect(Exercise.safeParse(exercise).success).toBe(true);
      if (exercise.type === 'type_translation') {
        for (const answer of exercise.answers)
          expect(checkExercise(exercise, { kind: 'text', text: answer }).correct).toBe(true);
      }
      if (exercise.type === 'speak_answer') {
        expect(
          checkExercise(exercise, { kind: 'speech', transcript: exercise.samples[0]! }).correct,
        ).toBe(true);
        expect(checkExercise(exercise, { kind: 'speech', transcript: 'hello' }).correct).toBe(
          false,
        );
      }
    }
  },
);
it('rejects an unknown scenario instead of recording an invented session', () =>
  expect(studySession('unknown')).toBeNull());

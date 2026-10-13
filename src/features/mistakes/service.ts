/**
 * The "Mistakes" section: exercises whose latest answer was wrong, from the last 30 days.
 * Answering one right removes it from the list, so the list is what still needs work.
 */
import { getCourse, getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';
import { expectedAnswer } from '@/core/scoring/check';

const WINDOW_DAYS = 30;
const LIMIT = 100;

/** An exercise of the course by id ("a1.u01.l03.e05" or "a1.u01.test.e02"), or null. */
export function findExercise(id: string): Exercise | null {
  const unitId = id.split('.').slice(0, 2).join('.');
  if (!getCourse().levels.some((l) => l.units.some((u) => u.id === unitId))) return null;
  const unit = getUnit(unitId);
  for (const lesson of unit.lessons) {
    const hit = lesson.exercises.find((e) => e.id === id);
    if (hit) return hit;
  }
  return unit.test.exercises.find((e) => e.id === id) ?? null;
}

export interface Mistake {
  exercise: Exercise;
  /** When the learner last got it wrong. */
  at: number;
}

export async function loadMistakes(db: Db, now = new Date()): Promise<Mistake[]> {
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  const rows = await db.all<{ exercise_id: string; at: number }>(
    `SELECT a.exercise_id AS exercise_id, a.at AS at FROM attempts a
     WHERE a.correct = 0 AND a.at >= ?
       AND a.at = (SELECT MAX(b.at) FROM attempts b WHERE b.exercise_id = a.exercise_id)
     ORDER BY a.at DESC LIMIT ?`,
    [since, LIMIT],
  );
  const out: Mistake[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.exercise_id)) continue;
    seen.add(r.exercise_id);
    const exercise = findExercise(r.exercise_id);
    // Generated exercises (reviews of words, own words) are not part of the course files.
    if (exercise) out.push({ exercise, at: r.at });
  }
  return out;
}

/** A short line that identifies the exercise in a list. */
export function promptOf(ex: Exercise): string {
  switch (ex.type) {
    case 'translate_choice':
    case 'type_translation':
    case 'fill_gap':
    case 'error_correction':
      return ex.text;
    case 'tiles':
      return ex.text;
    case 'listen_dictation':
    case 'speak_repeat':
      return ex.text;
    case 'listen_choice':
      return ex.audio;
    case 'speak_answer':
      return ex.question;
    case 'speak_describe':
      return ex.situation;
    case 'write':
      return ex.task;
    case 'minimal_pair':
      return `${ex.pair[0].en} / ${ex.pair[1].en}`;
    case 'word_stress':
      return ex.word;
    case 'match_pairs':
      return ex.pairs.map((p) => p.en).join(', ');
    case 'picture_choice':
      return ex.word;
    case 'comprehension':
      return ex.questions[0]?.kind === 'mcq'
        ? ex.questions[0].question
        : ex.questions[0]!.statement;
  }
}

export function correctAnswerOf(ex: Exercise): string {
  return expectedAnswer(ex);
}

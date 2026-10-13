import { getLexicon, getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';
import { checkExercise } from '@/core/scoring/check';
import { newCard, State, type SrsCard } from '@/core/srs/scheduler';

import { buildReview, REVIEW_SIZE, wordExercise, type ReviewSources } from '../generate';

const lexicon = getLexicon();
const words = [...lexicon.values()];
const unit = getUnit('a1.u01');
const courseExercises = unit.lessons.flatMap((l) => l.exercises);
const sources: ReviewSources = {
  word: (id) => lexicon.get(id),
  words,
  grammarExercises: (id) => courseExercises.filter((e) => e.grammar.includes(id)),
};
const now = new Date('2026-10-13T10:00:00');
const stable = (c: SrsCard): SrsCard => ({ ...c, state: State.Review, stability: 30 });

describe('review generation', () => {
  it('uses recognition for new words and recall for stable ones', () => {
    const fresh = wordExercise(
      newCard('word', 'teacher', now),
      lexicon.get('teacher')!,
      words,
      's1',
    );
    expect(['translate_choice', 'listen_choice']).toContain(fresh.type);
    const known = wordExercise(
      stable(newCard('word', 'teacher', now)),
      lexicon.get('teacher')!,
      words,
      's1',
    );
    expect(known.type).toBe('type_translation');
  });

  it('accepts a noun typed with an article in recall', () => {
    const ex = wordExercise(
      stable(newCard('word', 'engineer', now)),
      lexicon.get('engineer')!,
      words,
      's',
    );
    expect(checkExercise(ex, { kind: 'text', text: 'an engineer' }).correct).toBe(true);
    expect(checkExercise(ex, { kind: 'text', text: 'engineer' }).correct).toBe(true);
  });

  it('picks distinct distractors of the same part of speech', () => {
    for (let i = 0; i < 20; i++) {
      const ex = wordExercise(
        newCard('word', 'doctor', now),
        lexicon.get('doctor')!,
        words,
        `seed${i}`,
      );
      const options =
        ex.type === 'translate_choice' || ex.type === 'listen_choice' ? ex.options : [];
      expect(new Set(options).size).toBe(3);
      if (ex.type === 'translate_choice') {
        const posOf = (ru: string) => words.find((w) => w.ru[0] === ru)?.pos;
        expect(options.map(posOf)).toEqual(['noun', 'noun', 'noun']);
      }
    }
  });

  it('rotates grammar exercises between reviews', () => {
    const card = newCard('grammar', 'a1.be-present', now);
    const a = buildReview([card], sources, 'x')[0]!;
    const b = buildReview([{ ...card, reps: 1 }], sources, 'x')[0]!;
    expect(a.id).not.toBe(b.id);
    expect(a.grammar).toEqual(['a1.be-present']);
  });

  it('limits the session and skips unknown references', () => {
    const cards = [
      ...words.slice(0, 30).map((w) => newCard('word', w.id, now)),
      newCard('word', 'no-such-word', now),
    ];
    const session = buildReview(cards, sources, 'x');
    expect(session).toHaveLength(REVIEW_SIZE);
    expect(new Set(session.map((e) => e.id)).size).toBe(REVIEW_SIZE);
  });

  it('never offers two options with the same text, for any word and seed', () => {
    for (const w of words) {
      for (const seed of ['a', 'b', 'c', 'd']) {
        const ex = wordExercise(newCard('word', w.id, now), w, words, seed);
        if (ex.type === 'translate_choice' || ex.type === 'listen_choice') {
          expect([w.id, new Set(ex.options).size]).toEqual([w.id, ex.options.length]);
        }
      }
    }
  });

  it('every generated word exercise accepts its own answer', () => {
    const all: Exercise[] = words.flatMap((w) => [
      wordExercise(newCard('word', w.id, now), w, words, w.id),
      wordExercise(stable(newCard('word', w.id, now)), w, words, w.id),
    ]);
    for (const ex of all) {
      const response =
        ex.type === 'type_translation'
          ? { kind: 'text' as const, text: ex.answers[0]! }
          : { kind: 'choice' as const, index: 0 };
      expect([ex.id, checkExercise(ex, response).correct]).toEqual([ex.id, true]);
    }
  });
});

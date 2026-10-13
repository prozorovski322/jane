import { checkExercise } from '../check';
import { missingWords, speechSimilarity } from '../speech';

describe('missingWords', () => {
  it('lists the target words that were not said', () => {
    expect(missingWords('my name Anna', 'My name is Anna')).toEqual(['is']);
    expect(missingWords('', 'good morning')).toEqual(['good', 'morning']);
  });

  it('is empty when everything was heard, ignoring case and punctuation', () => {
    expect(missingWords('Good morning!', 'good morning')).toEqual([]);
  });

  it('agrees with the similarity score', () => {
    const said = 'i live in flat';
    const target = 'I live in a small flat';
    const missing = missingWords(said, target);
    expect(missing).toEqual(['a', 'small']);
    expect(speechSimilarity(said, target)).toBeCloseTo(1 - missing.length / 6, 5);
  });
});

describe('speak_repeat verdict', () => {
  const ex = {
    id: 'x.1',
    type: 'speak_repeat',
    text: 'My name is Anna',
    explanation: 'Скажите фразу целиком.',
  } as never;

  it('names the words that were missed', () => {
    const v = checkExercise(ex, { kind: 'speech', transcript: 'my name Anna' });
    expect(v.speech?.missing).toEqual(['is']);
  });

  it('has nothing missing on a perfect repeat', () => {
    const v = checkExercise(ex, { kind: 'speech', transcript: 'My name is Anna' });
    expect(v.correct).toBe(true);
    expect(v.speech?.missing).toEqual([]);
  });
});

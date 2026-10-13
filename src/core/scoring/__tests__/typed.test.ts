import { editDistance } from '../distance';
import { canonicalTokens } from '../normalize';
import { speechSimilarity } from '../speech';
import { matchTyped } from '../typed';

describe('editDistance', () => {
  it.each([
    ['teacher', 'teacher', 0],
    ['teacher', 'teachr', 1],
    ['teacher', 'taecher', 1],
    ['', 'abc', 3],
    ['kitten', 'sitting', 3],
  ])('%s / %s = %d', (a, b, d) => {
    expect(editDistance(a, b)).toBe(d);
  });
});

describe('canonicalTokens', () => {
  it('expands contractions so short and full forms compare equal', () => {
    expect(canonicalTokens("I'm from Kazan.", 'en')).toEqual(
      canonicalTokens('I am from Kazan', 'en'),
    );
    expect(canonicalTokens("She's a nurse", 'en')).toEqual(['she', 'is', 'a', 'nurse']);
    expect(canonicalTokens("They don't", 'en')).toEqual(['they', 'do', 'not']);
  });

  it("keeps possessive 's after nouns", () => {
    expect(canonicalTokens("Anna's friend", 'en')).toEqual(["anna's", 'friend']);
  });

  it('folds ё and ignores punctuation in Russian', () => {
    expect(canonicalTokens('Ещё раз, пожалуйста!', 'ru')).toEqual(['еще', 'раз', 'пожалуйста']);
  });
});

describe('matchTyped', () => {
  const en = { lang: 'en' as const };

  it('accepts any listed alternative, ignoring case and punctuation', () => {
    expect(matchTyped('thanks', ['Thank you!', 'Thanks!'], en)).toEqual({
      verdict: 'correct',
      matched: 'Thanks!',
    });
  });

  it('accepts a contraction for a full form', () => {
    expect(matchTyped('I am a teacher', ["I'm a teacher."], en).verdict).toBe('correct');
  });

  it('accepts a small typo in a long word and reports it', () => {
    const m = matchTyped("She's a nurce", ["She's a nurse."], en);
    expect(m).toEqual({
      verdict: 'typo',
      matched: "She's a nurse.",
      typos: [{ typed: 'nurce', expected: 'nurse' }],
    });
  });

  it('never forgives a wrong short word such as an article', () => {
    expect(matchTyped("He's a engineer", ["He's an engineer."], en).verdict).toBe('wrong');
  });

  it('rejects a typo that is another real word', () => {
    const isWord = (w: string) => ['three', 'tree'].includes(w);
    expect(matchTyped('tree', ['three'], { lang: 'en', isWord }).verdict).toBe('wrong');
  });

  it('rejects missing words', () => {
    expect(matchTyped('I teacher', ["I'm a teacher."], en).verdict).toBe('wrong');
  });

  it('forgives a different word split', () => {
    expect(matchTyped('good bye', ['goodbye'], en).verdict).toBe('typo');
  });

  it('treats an empty answer as wrong', () => {
    expect(matchTyped('   ', ['yes'], en).verdict).toBe('wrong');
  });
});

describe('speechSimilarity', () => {
  it('is 1 for the same sentence and tolerant to contractions', () => {
    expect(speechSimilarity('thank you nice to meet you', 'Thank you! Nice to meet you.')).toBe(1);
    expect(speechSimilarity('I am a new designer', "I'm a new designer.")).toBe(1);
  });

  it('drops with missing words', () => {
    expect(speechSimilarity('nice meet', 'Nice to meet you!')).toBe(0.5);
  });
});

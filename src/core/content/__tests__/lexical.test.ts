import {
  countWords,
  expandContraction,
  headwordTokens,
  lemmaCandidates,
  tokenize,
} from '../lexical';

describe('tokenize', () => {
  it('drops punctuation and marks sentence starts', () => {
    const tokens = tokenize('Hi, Max! How are you?');
    expect(tokens.map((t) => t.raw)).toEqual(['Hi', 'Max', 'How', 'are', 'you']);
    expect(tokens.map((t) => t.sentenceStart)).toEqual([true, false, true, false, false]);
  });

  it('keeps contractions together and normalizes typographic apostrophes', () => {
    expect(tokenize('I’m Anna, she’s Kate.').map((t) => t.lower)).toEqual([
      "i'm",
      'anna',
      "she's",
      'kate',
    ]);
  });

  it('splits spelled-out letters', () => {
    expect(tokenize('K-U-Z').map((t) => t.raw)).toEqual(['K', 'U', 'Z']);
  });
});

describe('expandContraction', () => {
  it.each([
    ["i'm", ['i', 'am']],
    ["don't", ['do', 'not']],
    ["won't", ['will', 'not']],
    ["they're", ['they', 'are']],
    ["anna's", ['anna']],
    ['hello', ['hello']],
  ])('%s → %j', (input, expected) => {
    expect(expandContraction(input)).toEqual(expected);
  });
});

describe('lemmaCandidates', () => {
  const irregular = new Map([['went', ['go']]]);

  it.each([
    ['students', 'student'],
    ['cities', 'city'],
    ['watches', 'watch'],
    ['stopped', 'stop'],
    ['liked', 'like'],
    ['studied', 'study'],
    ['making', 'make'],
    ['running', 'run'],
    ['bigger', 'big'],
    ['happiest', 'happy'],
    ['is', 'be'],
    ['went', 'go'],
  ])('%s → %s', (form, base) => {
    expect(lemmaCandidates(form, irregular)).toContain(base);
  });

  it('always includes the word itself', () => {
    expect(lemmaCandidates('news')[0]).toBe('news');
  });
});

describe('headwordTokens / countWords', () => {
  it('splits phrases into words', () => {
    expect(headwordTokens('nice to meet you')).toEqual(['nice', 'to', 'meet', 'you']);
  });

  it('counts contractions as one word', () => {
    expect(countWords("Hi! I'm Max, a designer.")).toBe(5);
  });
});

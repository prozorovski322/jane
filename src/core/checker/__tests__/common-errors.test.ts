import { findCommonMistakes } from '../common-errors';

const ids = (text: string) => findCommonMistakes(text).map((a) => a.id);

describe('common mistakes of Russian speakers', () => {
  it.each([
    ['i like tea.', 'i-lowercase'],
    ['Yes, i am here.', 'i-lowercase'],
    ["i'm Anna.", 'i-lowercase'],
    ['I am agree with you.', 'am-agree'],
    ['I have 20 years.', 'have-years'],
    ['She have two brothers.', 'third-person-s'],
    ['He like football.', 'third-person-s'],
    ['People is nice here.', 'people-is'],
    ["I didn't went home.", 'did-past'],
    ['It is more better now.', 'double-comparative'],
    ['I very like music.', 'very-like'],
    ['We meet in Monday.', 'day-preposition'],
    ['There have a cat in the room.', 'there-have'],
    ['He is a engineer.', 'a-before-vowel'],
    ['She has an book.', 'an-before-consonant'],
  ])('finds %s', (text, id) => {
    expect(ids(text)).toContain(id);
  });

  it.each([
    'I like tea.',
    "I'm a teacher and I live in Moscow.",
    'Does he like football?',
    'What does she do? She works in a bank.',
    'He can go home. She will have lunch.',
    'I have 2 brothers and a sister.',
    'I am 20 years old.',
    'He is an engineer. She has a book.',
    'It is a university. I have an hour.',
    'She is an honest girl and a European tourist.',
    'We meet on Monday. There is a cat.',
    'People are nice. The children have toys.',
    "I didn't go home. It is better now.",
  ])('leaves correct English alone: %s', (text) => {
    expect(ids(text)).toEqual([]);
  });

  it('reports each rule once and quotes what the learner wrote', () => {
    const found = findCommonMistakes('She have a dog. He like cats.');
    expect(found).toHaveLength(1);
    expect(found[0]!.fragment).toBe('She have');
  });

  it('understands typographic apostrophes', () => {
    expect(ids('I didn’t went.')).toContain('did-past');
  });
});

import { GrammarParseError, parseGrammarMarkdown } from '../grammar-md';

const source = `---
id: a1.test
level: A1
title: Тест
---
## Heading
First line
continues here.
- one
- two
> I'm Anna. | Я Анна.
! I Anna. => I'm Anna. | Нужен глагол.
TIP: Совет.

| A | B |
|---|---|
| 1 | 2 |
`;

describe('parseGrammarMarkdown', () => {
  it('parses front matter and every block type', () => {
    const { meta, blocks } = parseGrammarMarkdown(source);
    expect(meta).toEqual({ id: 'a1.test', level: 'A1', title: 'Тест' });
    expect(blocks).toEqual([
      { type: 'heading', text: 'Heading' },
      { type: 'paragraph', text: 'First line continues here.' },
      { type: 'list', items: ['one', 'two'] },
      { type: 'example', en: "I'm Anna.", ru: 'Я Анна.' },
      { type: 'mistake', wrong: 'I Anna.', right: "I'm Anna.", why: 'Нужен глагол.' },
      { type: 'tip', text: 'Совет.' },
      { type: 'table', header: ['A', 'B'], rows: [['1', '2']] },
    ]);
  });

  it('reports malformed examples with a line number', () => {
    expect(() => parseGrammarMarkdown('> no translation here')).toThrow(GrammarParseError);
    expect(() => parseGrammarMarkdown('> no translation here')).toThrow(/line 1/);
  });

  it('rejects table rows with the wrong number of cells', () => {
    expect(() => parseGrammarMarkdown('| a | b |\n|---|---|\n| 1 |')).toThrow(/expected 2/);
  });
});

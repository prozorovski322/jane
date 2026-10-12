/**
 * Parser for grammar notes written in a small Markdown dialect.
 *
 * ```
 * ---
 * id: a1.be-present
 * level: A1
 * title: Глагол to be
 * topic: to be: present
 * summary: Одна строка о главном.
 * troubles: word-order, articles
 * ---
 * ## Heading
 * Paragraph text, **bold** allowed.
 * - list item
 * > I'm a designer. | Я дизайнер.             ← example (English | Russian)
 * ! I designer. => I'm a designer. | Почему.    ← typical mistake
 * TIP: Совет.                                   ← tip
 * | Table | header |
 * |---|---|
 * | cell | cell |
 * ```
 */
import type { GrammarBlock } from './schema';

export interface ParsedGrammarNote {
  meta: Record<string, string>;
  blocks: GrammarBlock[];
}

export class GrammarParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`line ${line}: ${message}`);
  }
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function parseGrammarMarkdown(source: string): ParsedGrammarNote {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const meta: Record<string, string> = {};
  let i = 0;

  if (lines[0]?.trim() === '---') {
    i = 1;
    for (; i < lines.length && lines[i]!.trim() !== '---'; i++) {
      const m = /^([a-zA-Z]+):\s*(.*)$/.exec(lines[i]!);
      if (!m) throw new GrammarParseError('bad front matter line', i + 1);
      meta[m[1]!] = m[2]!.trim();
    }
    if (i >= lines.length) throw new GrammarParseError('unterminated front matter', i);
    i++;
  }

  const blocks: GrammarBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    if (list.length) blocks.push({ type: 'list', items: list });
    paragraph = [];
    list = [];
  };

  for (; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    const n = i + 1;

    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      list.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith('> ')) {
      flush();
      const parts = line.slice(2).split(' | ');
      if (parts.length !== 2) throw new GrammarParseError('example must be "English | Russian"', n);
      blocks.push({ type: 'example', en: parts[0]!.trim(), ru: parts[1]!.trim() });
      continue;
    }
    if (line.startsWith('! ')) {
      flush();
      const m = /^!\s+(.+?)\s+=>\s+(.+?)\s+\|\s+(.+)$/.exec(line);
      if (!m) throw new GrammarParseError('mistake must be "! wrong => right | why"', n);
      blocks.push({ type: 'mistake', wrong: m[1]!, right: m[2]!, why: m[3]! });
      continue;
    }
    if (line.startsWith('TIP:')) {
      flush();
      blocks.push({ type: 'tip', text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const header = splitRow(line);
      const sep = lines[i + 1]?.trim() ?? '';
      if (!/^\|?\s*:?-{3,}/.test(sep)) throw new GrammarParseError('table needs a separator', n);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const row = splitRow(lines[i]!);
        if (row.length !== header.length) {
          throw new GrammarParseError(`table row has ${row.length} cells, expected ${header.length}`, i + 1);
        }
        rows.push(row);
        i++;
      }
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (list.length) flush();
    paragraph.push(line);
  }
  flush();

  return { meta, blocks };
}

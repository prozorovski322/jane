/**
 * Reads everything under `content/`, validates it against the Zod schemas and returns typed data
 * plus a list of issues. Never throws on bad content: problems are reported as issues.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';

import { parseGrammarMarkdown } from '../../src/core/content/grammar-md';
import {
  Course,
  GrammarNote,
  LevelTest,
  Unit,
  type Course as CourseT,
  type GrammarNote as GrammarNoteT,
  type LevelTest as LevelTestT,
  type Unit as UnitT,
} from '../../src/core/content/schema';

export const ROOT = join(__dirname, '..', '..');
export const CONTENT_DIR = join(ROOT, 'content');

export interface Issue {
  severity: 'error' | 'warning';
  file: string;
  /** Location inside the file, e.g. "lessons[2].exercises[4].answer". */
  path: string;
  message: string;
}

export interface LexiconExtras {
  /** Tokens allowed at any level: letter names, interjections, titles. */
  alwaysAllowed: Set<string>;
  /** Proper names that may appear in texts. */
  names: Set<string>;
  /** Irregular form → base forms. */
  irregular: Map<string, string[]>;
}

export interface LoadedContent {
  course: CourseT | null;
  /** Units in course order (units missing from course.json are appended). */
  units: UnitT[];
  levelTests: LevelTestT[];
  grammar: Map<string, GrammarNoteT>;
  extras: LexiconExtras;
  /** Source file of every unit / grammar note / level test, keyed by id. */
  files: Map<string, string>;
  issues: Issue[];
}

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full, ext);
      return name.endsWith(ext) ? [full] : [];
    });
}

function rel(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/');
}

function zodIssues(file: string, error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    severity: 'error' as const,
    file: rel(file),
    path: i.path
      .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
      .join('')
      .replace(/^\./, ''),
    message: i.message,
  }));
}

function readJson(file: string, issues: Issue[]): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    issues.push({
      severity: 'error',
      file: rel(file),
      path: '',
      message: `invalid JSON: ${(e as Error).message}`,
    });
    return undefined;
  }
}

function parseFile<T>(
  file: string,
  schema: z.ZodType<T>,
  data: unknown,
  issues: Issue[],
): T | null {
  if (data === undefined) return null;
  const r = schema.safeParse(data);
  if (!r.success) {
    issues.push(...zodIssues(file, r.error));
    return null;
  }
  return r.data;
}

function loadExtras(issues: Issue[]): LexiconExtras {
  const dir = join(CONTENT_DIR, 'lexicon');
  const list = (name: string): string[] => {
    const file = join(dir, name);
    if (!existsSync(file)) return [];
    const data = parseFile(file, z.array(z.string().min(1)), readJson(file, issues), issues);
    return data ?? [];
  };
  const irregular = new Map<string, string[]>();
  const irrFile = join(dir, 'irregular-verbs.json');
  if (existsSync(irrFile)) {
    const Irr = z.array(z.tuple([z.string(), z.string(), z.string()]));
    for (const [base, past, pp] of parseFile(irrFile, Irr, readJson(irrFile, issues), issues) ??
      []) {
      for (const form of [...past.split('/'), ...pp.split('/')]) {
        const bases = irregular.get(form) ?? [];
        if (!bases.includes(base)) bases.push(base);
        irregular.set(form, bases);
      }
    }
  }
  return {
    alwaysAllowed: new Set(list('always-allowed.json').map((s) => s.toLowerCase())),
    names: new Set(list('names.json').map((s) => s.toLowerCase())),
    irregular,
  };
}

const GrammarFrontMatter = z.strictObject({
  id: z.string(),
  level: z.string(),
  title: z.string(),
  topic: z.string(),
  summary: z.string(),
  troubles: z.string().optional(),
});

export function loadContent(): LoadedContent {
  const issues: Issue[] = [];
  const files = new Map<string, string>();

  const courseFile = join(CONTENT_DIR, 'course.json');
  const course = parseFile(courseFile, Course, readJson(courseFile, issues), issues);

  // Grammar notes.
  const grammar = new Map<string, GrammarNoteT>();
  for (const file of walk(join(CONTENT_DIR, 'grammar'), '.md')) {
    let parsed;
    try {
      parsed = parseGrammarMarkdown(readFileSync(file, 'utf8'));
    } catch (e) {
      issues.push({ severity: 'error', file: rel(file), path: '', message: (e as Error).message });
      continue;
    }
    const fm = parseFile(file, GrammarFrontMatter, parsed.meta, issues);
    if (!fm) continue;
    const note = parseFile(
      file,
      GrammarNote,
      {
        ...fm,
        troubles: fm.troubles ? fm.troubles.split(',').map((s) => s.trim()) : [],
        blocks: parsed.blocks,
      },
      issues,
    );
    if (!note) continue;
    if (grammar.has(note.id)) {
      issues.push({
        severity: 'error',
        file: rel(file),
        path: 'id',
        message: `duplicate grammar id ${note.id}`,
      });
    }
    grammar.set(note.id, note);
    files.set(note.id, rel(file));
  }

  // Units and level tests.
  const byId = new Map<string, UnitT>();
  const levelTests: LevelTestT[] = [];
  for (const file of walk(join(CONTENT_DIR, 'levels'), '.json')) {
    const data = readJson(file, issues);
    if (file.endsWith('level-test.json')) {
      const t = parseFile(file, LevelTest, data, issues);
      if (t) {
        levelTests.push(t);
        files.set(`${t.level.toLowerCase()}.level-test`, rel(file));
      }
      continue;
    }
    const unit = parseFile(file, Unit, data, issues);
    if (!unit) continue;
    if (byId.has(unit.id)) {
      issues.push({
        severity: 'error',
        file: rel(file),
        path: 'id',
        message: `duplicate unit id ${unit.id}`,
      });
    }
    byId.set(unit.id, unit);
    files.set(unit.id, rel(file));
  }

  const units: UnitT[] = [];
  for (const level of course?.levels ?? []) {
    for (const id of level.units) {
      const unit = byId.get(id);
      if (!unit) {
        // Units listed in course.json but not written yet are reported by the checker.
        continue;
      }
      units.push(unit);
      byId.delete(id);
    }
  }
  for (const unit of byId.values()) {
    issues.push({
      severity: 'error',
      file: files.get(unit.id) ?? '',
      path: 'id',
      message: `unit ${unit.id} is not listed in content/course.json`,
    });
    units.push(unit);
  }

  return { course, units, levelTests, grammar, extras: loadExtras(issues), files, issues };
}

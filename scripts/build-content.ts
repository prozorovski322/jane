/**
 * Validates `content/` and compiles it into `src/core/content/generated/`:
 *   course.json   — outline of levels, units and lessons (small, loaded at startup)
 *   lexicon.json  — all words with their unit and level (dictionary, SRS)
 *   grammar.json  — grammar reference
 *   placement.json — placement test item bank
 *   units/*.json  — full units, loaded lazily (units.native.ts in the app)
 * and copies the units to `public/content/units/` for the website, which downloads them on
 * demand (units.ts) instead of shipping them inside its script.
 *
 * Generated files (both places) are committed; CI rebuilds them and fails if they differ from
 * the sources.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CourseOutline,
  LexiconEntry,
  UnitBundle,
  UnitOutline,
} from '../src/core/content/bundle-types';
import { exerciseStrings } from '../src/core/content/extract';
import {
  expandContraction,
  headwordTokens,
  lemmaCandidates,
  tokenize,
} from '../src/core/content/lexical';
import type { Exercise, Unit } from '../src/core/content/schema';
import { checkContent } from './lib/check';
import { loadContent, ROOT } from './lib/load';
import { printIssues } from './lib/report';

const OUT = join(ROOT, 'src', 'core', 'content', 'generated');
/** Units for the website, served as static files next to the app. */
const WEB_UNITS = join(ROOT, 'public', 'content', 'units');

/** Function words are not tracked per exercise: they are everywhere. */
const UNTRACKED_POS = new Set(['pron', 'det', 'conj']);

function withDerivedWords(
  ex: Exercise,
  unit: Unit,
  irregular: ReadonlyMap<string, readonly string[]>,
): Exercise {
  const lemmas = new Set(
    exerciseStrings(ex)
      .en.flatMap((s) => tokenize(s).flatMap((t) => expandContraction(t.lower)))
      .flatMap((p) => lemmaCandidates(p, irregular)),
  );
  const words = new Set(ex.words);
  if (ex.type === 'picture_choice') words.add(ex.word);
  for (const w of unit.words) {
    if (UNTRACKED_POS.has(w.pos)) continue;
    if (headwordTokens(w.en).every((t) => lemmas.has(t))) words.add(w.id);
  }
  return { ...ex, words: [...words] };
}

function writeJson(file: string, data: unknown) {
  writeFileSync(file, JSON.stringify(data) + '\n', 'utf8');
}

function main() {
  const content = loadContent();
  const issues = checkContent(content);
  const errors = printIssues(issues, { quiet: true });
  if (errors > 0 || !content.course) {
    console.error('\nContent has errors; bundle not written.');
    process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'units'), { recursive: true });

  const lexicon: LexiconEntry[] = [];
  const outlines = new Map<string, UnitOutline>();
  const { irregular } = content.extras;

  const inLexicon = new Set<string>();
  for (const unit of content.units) {
    // A track may reuse a word of a higher level: the lexicon keeps the level's entry only.
    for (const w of unit.words) {
      if (inLexicon.has(w.id)) continue;
      inLexicon.add(w.id);
      lexicon.push({ ...w, unit: unit.id, level: unit.level });
    }

    const { words, ...rest } = unit;
    const bundle: UnitBundle = {
      ...rest,
      wordIds: words.map((w) => w.id),
      lessons: unit.lessons.map((l) => ({
        ...l,
        exercises: l.exercises.map((e) => withDerivedWords(e, unit, irregular)),
      })),
      test: {
        ...unit.test,
        exercises: unit.test.exercises.map((e) => withDerivedWords(e, unit, irregular)),
      },
    };
    writeJson(join(OUT, 'units', `${unit.id}.json`), bundle);

    outlines.set(unit.id, {
      id: unit.id,
      level: unit.level,
      order: unit.order,
      title: unit.title,
      description: unit.description,
      goals: unit.goals,
      grammar: unit.grammar,
      wordCount: unit.words.length,
      lessons: unit.lessons.map((l) => ({
        id: l.id,
        kind: l.kind,
        title: l.title,
        exerciseCount: l.exercises.length,
      })),
      testExerciseCount: unit.test.exercises.length,
    });
  }

  const outline: CourseOutline = {
    version: content.course.version,
    levels: content.course.levels.map((l) => {
      const modules = l.modules.map((m) => ({
        id: m.id,
        order: m.order,
        title: m.title,
        goals: m.goals,
        units: m.units.map((id) => outlines.get(id)!),
        planned: m.planned,
      }));
      return {
        level: l.level,
        title: l.title,
        description: l.description,
        canDo: l.canDo,
        vocabTarget: l.vocabTarget,
        grammarScope: l.grammarScope,
        functions: l.functions,
        modules,
        units: modules.flatMap((m) => m.units),
      };
    }),
    tracks: content.course.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      requires: t.requires,
      units: t.units.map((id) => outlines.get(id)!),
      planned: t.planned,
    })),
  };

  writeJson(join(OUT, 'course.json'), outline);
  writeJson(join(OUT, 'lexicon.json'), lexicon);
  writeJson(join(OUT, 'grammar.json'), [...content.grammar.values()]);
  writeJson(join(OUT, 'placement.json'), content.placement);

  const unitIds = readdirSync(join(OUT, 'units'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
  writeFileSync(
    join(OUT, 'index.ts'),
    `// Generated by scripts/build-content.ts — do not edit.
import type { PlacementBank } from '../schema';
import type { CourseOutline, GrammarBundle, LexiconEntry } from '../bundle-types';

export const loadCourse = () => require('./course.json') as CourseOutline;
export const loadLexicon = () => require('./lexicon.json') as LexiconEntry[];
export const loadGrammar = () => require('./grammar.json') as GrammarBundle;
export const loadPlacement = () => require('./placement.json') as PlacementBank;

export const unitIds: readonly string[] = [
${unitIds.map((id) => `  '${id}',`).join('\n')}
];
`,
    'utf8',
  );

  // Native apps bundle every unit and read it synchronously.
  writeFileSync(
    join(OUT, 'units.native.ts'),
    `// Generated by scripts/build-content.ts — do not edit.
import type { UnitBundle } from '../bundle-types';

const loaders: Record<string, () => UnitBundle> = {
${unitIds.map((id) => `  '${id}': () => require('./units/${id}.json') as UnitBundle,`).join('\n')}
};

export const loadUnitSync = (id: string): UnitBundle | undefined => loaders[id]?.();
export const fetchUnit = async (id: string): Promise<UnitBundle> => loaders[id]!();
`,
    'utf8',
  );

  // The website keeps units out of the script and downloads each one when it is needed. File
  // names carry a hash of the content, so browsers and the offline cache never serve a stale unit.
  rmSync(WEB_UNITS, { recursive: true, force: true });
  mkdirSync(WEB_UNITS, { recursive: true });
  const webFiles = unitIds.map((id) => {
    const data = readFileSync(join(OUT, 'units', `${id}.json`));
    const file = `${id}.${createHash('sha256').update(data).digest('hex').slice(0, 10)}.json`;
    writeFileSync(join(WEB_UNITS, file), data);
    return [id, file] as const;
  });
  writeFileSync(
    join(OUT, 'units.ts'),
    `// Generated by scripts/build-content.ts — do not edit.
// Website version; the native app uses units.native.ts.
import type { UnitBundle } from '../bundle-types';
import { fetchContent } from '../fetch-web';

const files: Record<string, string> = {
${webFiles.map(([id, file]) => `  '${id}': '${file}',`).join('\n')}
};

export const loadUnitSync = (_id: string): UnitBundle | undefined => undefined;
export const fetchUnit = (id: string): Promise<UnitBundle> =>
  fetchContent<UnitBundle>(\`/content/units/\${files[id]}\`);
`,
    'utf8',
  );

  console.log(
    `Bundle written: ${content.units.length} unit(s), ${lexicon.length} word(s), ${content.grammar.size} grammar note(s), content ${content.course.version}`,
  );
}

main();

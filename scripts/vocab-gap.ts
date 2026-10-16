/**
 * Which common words (scripts/data/basic-words.txt) a learner still has not met by the end of a
 * level, and where in the course each of them appears now. Used to plan vocabulary additions.
 *
 *   npx tsx scripts/vocab-gap.ts [level]   # default: A2
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { headwordTokens, lemmaCandidates } from '../src/core/content/lexical';
import { LEVELS, type Level } from '../src/core/content/schema';
import { loadContent } from './lib/load';

const level = (process.argv[2] ?? 'A2') as Level;
const upTo = LEVELS.slice(0, LEVELS.indexOf(level) + 1);

const basic = [
  ...new Set(
    readFileSync(join(__dirname, 'data', 'basic-words.txt'), 'utf8')
      .split('\n')
      .filter((l) => !l.startsWith('#'))
      .flatMap((l) => l.split(/\s+/))
      .filter(Boolean)
      .map((w) => w.toLowerCase()),
  ),
];

const content = loadContent();
const { irregular, alwaysAllowed, names } = content.extras;

const allowed = new Set<string>();
const firstSeen = new Map<string, string>();
for (const u of content.units) {
  for (const w of u.words) {
    const tokens = [
      ...headwordTokens(w.en),
      ...Object.values(w.forms ?? {}).flatMap((f) => headwordTokens(f)),
    ];
    for (const t of tokens) if (!firstSeen.has(t)) firstSeen.set(t, u.id);
    if (!u.track && upTo.includes(u.level)) for (const t of tokens) allowed.add(t);
  }
}

const known = (w: string) =>
  alwaysAllowed.has(w) || names.has(w) || lemmaCandidates(w, irregular).some((c) => allowed.has(c));

const missing = basic.filter((w) => !known(w));
console.log(`${basic.length} words checked, ${missing.length} not known by the end of ${level}:`);
for (const w of missing) {
  const c = lemmaCandidates(w, irregular).find((x) => firstSeen.has(x));
  console.log(`${w.padEnd(14)} ${c ? firstSeen.get(c) : '—'}`);
}

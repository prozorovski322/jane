/**
 * Validates all course content. Exit code 1 when there are errors (or warnings with --strict).
 *
 *   npm run content:check            errors and warnings
 *   npm run content:check -- --quiet errors only
 *   npm run content:check -- --strict fail on warnings too
 */
import { checkContent } from './lib/check';
import { loadContent } from './lib/load';
import { printIssues } from './lib/report';

const args = new Set(process.argv.slice(2));
const content = loadContent();
const issues = checkContent(content);
const errors = printIssues(issues, { quiet: args.has('--quiet') });

const words = content.units.reduce((n, u) => n + u.words.length, 0);
const lessons = content.units.reduce((n, u) => n + u.lessons.length, 0);
const exercises = content.units.reduce(
  (n, u) => n + u.lessons.reduce((m, l) => m + l.exercises.length, 0) + u.test.exercises.length,
  0,
);
console.log(
  `${content.units.length} unit(s), ${lessons} lesson(s), ${exercises} exercise(s), ${words} word(s), ${content.grammar.size} grammar note(s)`,
);

if (errors > 0 || (args.has('--strict') && issues.length > 0)) process.exit(1);

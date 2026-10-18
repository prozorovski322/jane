// Adds offline support to the exported website: writes dist/sw.js, a service worker that stores
// the site itself on the first visit and course units as they are opened (scripts/web/sw-template.js).
// Run after `expo export`. Usage: node scripts/web-offline.mjs [dir]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
/** Host configuration, crawler files and build metadata are not part of the app. */
const SKIP = new Set([
  'sw.js',
  '_headers',
  '_redirects',
  'metadata.json',
  'robots.txt',
  'sitemap.xml',
  'og-image.png',
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root)
  .map((path) => relative(root, path).split(sep).join('/'))
  .filter((path) => !SKIP.has(path))
  .sort();
const isUnit = (p) => p.startsWith('content/units/');
const shell = files.filter((p) => !isUnit(p)).map((p) => `/${p}`);
const units = files.filter(isUnit).map((p) => `/${p}`);

// The version changes whenever any file does, so a new build replaces the stored site.
const hash = createHash('sha256');
for (const path of files) hash.update(path).update(readFileSync(join(root, path)));
const version = hash.digest('hex').slice(0, 12);

const template = readFileSync(new URL('./web/sw-template.js', import.meta.url), 'utf8');
writeFileSync(
  join(root, 'sw.js'),
  template
    .replace('__VERSION__', version)
    .replace('= __SHELL__;', `= ${JSON.stringify(shell)};`)
    .replace('= __UNITS__;', `= ${JSON.stringify(units)};`),
);

const mb = (list) =>
  (list.reduce((sum, p) => sum + statSync(join(root, p)).size, 0) / 1024 / 1024).toFixed(1);
console.log(
  `sw.js: version ${version}; site ${shell.length} files, ${mb(shell)} MB on the first visit; ` +
    `${units.length} units, ${mb(units)} MB as they are opened`,
);

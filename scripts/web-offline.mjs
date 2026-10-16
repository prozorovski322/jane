// Adds offline support to the exported website: writes dist/sw.js, a service worker that stores
// every file of the build (the app, its assets and all course units). Run after `expo export`.
// Usage: node scripts/web-offline.mjs [dir]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
/** Host configuration and build metadata are not part of the site. */
const SKIP = new Set(['sw.js', '_headers', '_redirects', 'metadata.json']);

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

// The version changes whenever any file does, so a new build replaces the stored one.
const hash = createHash('sha256');
for (const path of files) hash.update(path).update(readFileSync(join(root, path)));
const version = hash.digest('hex').slice(0, 12);

const template = readFileSync(new URL('./web/sw-template.js', import.meta.url), 'utf8');
writeFileSync(
  join(root, 'sw.js'),
  template
    .replace('__VERSION__', version)
    .replace('= __PRECACHE__;', `= ${JSON.stringify(files.map((p) => `/${p}`))};`),
);

const size = files.reduce((sum, p) => sum + statSync(join(root, p)).size, 0);
console.log(
  `sw.js: version ${version}, ${files.length} files, ${(size / 1024 / 1024).toFixed(1)} MB`,
);

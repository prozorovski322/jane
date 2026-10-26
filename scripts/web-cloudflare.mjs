// Cloudflare Pages serves Expo SPA routes from index.html when no file matches.
// The Netlify wildcard rewrite must be removed there because it also rewrites
// existing files, including the SQLite WebAssembly asset, to HTML.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
if (!existsSync(join(root, 'index.html'))) {
  throw new Error(`Cloudflare Pages output is missing index.html: ${root}`);
}

rmSync(join(root, '_redirects'), { force: true });

const oldOrigin = 'https://jane-english.netlify.app';
const newOrigin = 'https://jane-english.pages.dev';
for (const name of ['index.html', 'robots.txt', 'sitemap.xml']) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  const contents = readFileSync(path, 'utf8');
  writeFileSync(path, contents.replaceAll(oldOrigin, newOrigin));
}

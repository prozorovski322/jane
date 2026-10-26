// Cloudflare Pages serves Expo SPA routes from index.html when no file matches.
// The Netlify wildcard rewrite must be removed there because it also rewrites
// existing files, including the SQLite WebAssembly asset, to HTML.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
if (!existsSync(join(root, 'index.html'))) {
  throw new Error(`Cloudflare Pages output is missing index.html: ${root}`);
}

rmSync(join(root, '_redirects'), { force: true });

// Keep Expo's generated assets at the Pages root. Pages was serving the JS
// bundles but falling back to index.html for nested /assets/* URLs in this
// deployment, which breaks SQLite's WASM loader and fonts. Flat filenames
// avoid directory routing and remain content-addressed/cache-safe.
const assetsRoot = join(root, 'assets');
if (existsSync(assetsRoot)) {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  const replacements = new Map();
  for (const path of walk(assetsRoot)) {
    const contents = readFileSync(path);
    const hash = createHash('sha256').update(contents).digest('hex').slice(0, 16);
    const filename = `asset-${hash}${extname(path)}`;
    writeFileSync(join(root, filename), contents);
    replacements.set(`/${relative(root, path).split(sep).join('/')}`, `/${filename}`);
  }

  const rewriteReferences = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        rewriteReferences(path);
      } else if (/\.(?:html|js|css|json)$/i.test(name)) {
        let contents = readFileSync(path, 'utf8');
        for (const [from, to] of replacements) contents = contents.replaceAll(from, to);
        writeFileSync(path, contents);
      }
    }
  };
  rewriteReferences(root);
}

const oldOrigin = 'https://jane-english.netlify.app';
const newOrigin = 'https://jane-english.pages.dev';
for (const name of ['index.html', 'robots.txt', 'sitemap.xml']) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  const contents = readFileSync(path, 'utf8');
  writeFileSync(path, contents.replaceAll(oldOrigin, newOrigin));
}

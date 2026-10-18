// Serves the exported website (`npm run web:build` → dist/) the way the production host does:
// with the headers from dist/_headers (the same file Netlify reads: cross-origin isolation for
// expo-sqlite, the Content-Security-Policy) and every unknown path falling back to index.html
// (the site is a single-page app).
// Usage: node scripts/serve-web.mjs [dir] [port]
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8090);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** Netlify's _headers format: a path line, then indented "Name: value" lines. */
function readHeaders(file) {
  const rules = [];
  if (!existsSync(file)) return rules;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} });
    else if (rules.length) {
      const i = line.indexOf(':');
      rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

const rules = readHeaders(join(root, '_headers'));
const matches = (pattern, path) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' };
  for (const r of rules) if (matches(r.path, path)) Object.assign(headers, r.headers);
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));

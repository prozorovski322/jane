// Renders the website's PNG images (app icons, link preview) from scripts/web/images.html with
// Microsoft Edge in headless mode, into public/. Run when the design changes; the PNGs are
// committed. Usage: node scripts/web-images.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!EDGE) throw new Error('Microsoft Edge not found');

const page = pathToFileURL(resolve('scripts/web/images.html')).href;
const out = resolve('public');
const jobs = [
  { file: 'og-image.png', query: 'kind=og', w: 1200, h: 630 },
  { file: 'apple-touch-icon.png', query: 'kind=icon&size=180', w: 180, h: 180 },
  { file: 'icon-192.png', query: 'kind=icon&size=192', w: 192, h: 192 },
  { file: 'icon-512.png', query: 'kind=icon&size=512', w: 512, h: 512 },
];

for (const j of jobs) {
  // A throwaway profile, so a running Edge does not interfere.
  const profile = mkdtempSync(join(tmpdir(), 'jane-edge-'));
  try {
    execFileSync(EDGE, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--user-data-dir=${profile}`,
      `--window-size=${j.w},${j.h}`,
      '--virtual-time-budget=2000',
      `--screenshot=${join(out, j.file)}`,
      `${page}?${j.query}`,
    ]);
    console.log(`public/${j.file}`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

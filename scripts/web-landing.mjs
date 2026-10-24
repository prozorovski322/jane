import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const exported = readFileSync(join(root, 'index.html'), 'utf8');
if (!exported.includes('_expo/static/js/'))
  throw new Error('Expected a fresh Expo export before installing the landing page');
copyFileSync(join(root, 'index.html'), join(root, 'app.html'));
const landing = readFileSync(new URL('./web/landing.html', import.meta.url), 'utf8');
writeFileSync(join(root, 'index.html'), landing);
console.log('Public home installed; the Expo application is preserved in app.html');

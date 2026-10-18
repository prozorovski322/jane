// Makes the website's fonts: WOFF2 files with only the characters the course uses (Latin with
// accents, IPA, Cyrillic, punctuation, arrows), into assets/fonts/web/. The app keeps the full
// TTF files. Needs Python with fontTools and brotli: `pip install fonttools brotli`.
// Run when the fonts change; the WOFF2 files are committed. Usage: node scripts/web-fonts.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const OUT = resolve('assets/fonts/web');
const FONTS = {
  'Unbounded-600': '@expo-google-fonts/unbounded/600SemiBold/Unbounded_600SemiBold.ttf',
  'GolosText-400': '@expo-google-fonts/golos-text/400Regular/GolosText_400Regular.ttf',
  'GolosText-500': '@expo-google-fonts/golos-text/500Medium/GolosText_500Medium.ttf',
  'GolosText-600': '@expo-google-fonts/golos-text/600SemiBold/GolosText_600SemiBold.ttf',
  'GolosText-700': '@expo-google-fonts/golos-text/700Bold/GolosText_700Bold.ttf',
};
const UNICODES = [
  'U+0000-024F', // Latin, Latin-1, Latin Extended A–B
  'U+0250-02FF', // IPA, stress marks and other modifier letters
  'U+0300-036F', // combining accents
  'U+0400-045F', // Cyrillic (Russian and the basic set)
  'U+2000-206F', // punctuation: dashes, quotes, ellipsis
  'U+20AC,U+20BD,U+2116', // € ₽ №
  'U+2190-21FF', // arrows
  'U+2212,U+2248,U+2260,U+2264,U+2265,U+00D7', // − ≈ ≠ ≤ ≥ ×
].join(',');
/** Unbounded only sets headings and numbers: no IPA or rare Latin letters. */
const HEADINGS = [
  'U+0000-00FF',
  'U+0400-045F',
  'U+2000-206F',
  'U+20AC,U+20BD,U+2116',
  'U+2190-21FF',
].join(',');

mkdirSync(OUT, { recursive: true });
for (const [name, source] of Object.entries(FONTS)) {
  const input = resolve('node_modules', source);
  const output = resolve(OUT, `${name}.woff2`);
  // Run from the temp folder, so Python does not pick up modules from the project.
  execFileSync(
    'python',
    [
      '-m',
      'fontTools.subset',
      input,
      `--unicodes=${name.startsWith('Unbounded') ? HEADINGS : UNICODES}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting',
      '--desubroutinize',
      `--output-file=${output}`,
    ],
    { cwd: tmpdir(), stdio: 'inherit' },
  );
  const kb = (p) => Math.round(statSync(p).size / 1024);
  console.log(`${name}: ${kb(input)} KB TTF → ${kb(output)} KB WOFF2`);
}

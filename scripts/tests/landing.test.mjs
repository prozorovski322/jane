import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const callback = readFileSync(new URL('../../public/landing/callback.js', import.meta.url), 'utf8');
const landing = readFileSync(new URL('../web/landing.html', import.meta.url), 'utf8');

test('root sign-in callbacks retain the complete query and fragment on the same origin', () => {
  for (const [search, hash] of [
    ['?code=one-time-code&state=test', ''],
    ['', '#access_token=test&refresh_token=test&token_type=bearer'],
    ['?error=access_denied&error_description=Cancelled', ''],
  ]) {
    let target;
    runInNewContext(callback, {
      URLSearchParams,
      window: {
        location: {
          search,
          hash,
          replace: (value) => {
            target = value;
          },
        },
      },
    });
    assert.equal(target, `/auth${search}${hash}`);
  }
});

test('normal home navigation never follows user-supplied destinations', () => {
  for (const [search, hash] of [
    ['', '#course'],
    ['?redirect_to=https://attacker.example', ''],
    ['', ''],
  ]) {
    let called = false;
    runInNewContext(callback, {
      URLSearchParams,
      window: {
        location: {
          search,
          hash,
          replace: () => {
            called = true;
          },
        },
      },
    });
    assert.equal(called, false);
  }
});

test('build preserves the complete Expo entry while installing the public home', (t) => {
  const parent = resolve(tmpdir());
  const dir = mkdtempSync(join(parent, 'jane-landing-test-'));
  t.after(() => {
    if (!resolve(dir).startsWith(parent + sep)) throw new Error('Unexpected test directory');
    rmSync(dir, { recursive: true, force: true });
  });
  const expo = '<html><script src="/_expo/static/js/web/entry-test.js"></script></html>';
  writeFileSync(join(dir, 'index.html'), expo);
  const script = fileURLToPath(new URL('../web-landing.mjs', import.meta.url));
  const first = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(readFileSync(join(dir, 'app.html'), 'utf8'), expo);
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), landing);
  const second = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
  assert.notEqual(second.status, 0);
  assert.equal(readFileSync(join(dir, 'app.html'), 'utf8'), expo);
});

test('home uses local assets and directs learners into the real application', () => {
  assert.ok(landing.includes('/landing/callback.js'));
  assert.ok(landing.includes('href="/auth"'));
  assert.ok(landing.includes('href="/course"'));
  assert.ok(!landing.includes('Концепция обновления'));
  const css = readFileSync(new URL('../../public/landing/styles.css', import.meta.url), 'utf8');
  assert.ok(!css.includes('@import'));
  assert.ok(css.includes('/landing/fonts/GolosText-400.woff2'));
});

test('offline navigation keeps course and auth routes inside the app', async () => {
  const source = readFileSync(new URL('../web/sw-template.js', import.meta.url), 'utf8');
  let fetchHandler;
  runInNewContext(source, {
    URL,
    __SHELL__: [],
    __UNITS__: [],
    self: {
      location: { origin: 'https://jane.example' },
      addEventListener: (event, handler) => {
        if (event === 'fetch') fetchHandler = handler;
      },
    },
    fetch: async () => {
      throw new Error('offline');
    },
    caches: { match: async (path) => path },
  });
  for (const [path, expected] of [
    ['/', '/index.html'],
    ['/course', '/app.html'],
    ['/lesson/a1.u01.l01', '/app.html'],
    ['/auth?code=test', '/app.html'],
  ]) {
    let response;
    fetchHandler({
      request: { method: 'GET', url: `https://jane.example${path}`, mode: 'navigate' },
      respondWith: (value) => {
        response = value;
      },
    });
    assert.equal(await response, expected);
  }
});

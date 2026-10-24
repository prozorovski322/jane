import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../netlify/functions/yandex-userinfo.mjs';

const url = 'https://jane-english.netlify.app/.netlify/functions/yandex-userinfo';
const token = 'test-token-123456789';
const profile = {
  id: '123456',
  client_id: '6d6b261bc97b4f3eb5bc3e83ed05ccf8',
  default_email: 'person@example.com',
  real_name: 'Person',
};

test('rejects missing tokens and non-GET methods before contacting Yandex', async () => {
  assert.equal((await handler(new Request(url))).status, 401);
  assert.equal((await handler(new Request(url, { method: 'POST' }))).status, 405);
});

test('validates the token with Yandex and maps only validated profile fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async (target, options) => {
    assert.equal(target, 'https://login.yandex.ru/info?format=json');
    assert.equal(options.headers.Authorization, `OAuth ${token}`);
    assert.equal(options.redirect, 'error');
    return Response.json({ ...profile, access_token: 'must-not-leak' });
  });
  const result = await handler(new Request(url, { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), {
    sub: '123456',
    email: 'person@example.com',
    email_verified: false,
    name: 'Person',
  });
});

test('rejects tokens for other apps, missing identity and missing email', async (t) => {
  for (const bad of [
    { ...profile, client_id: 'another-app' },
    { ...profile, id: '' },
    { ...profile, default_email: null },
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(bad));
    assert.equal(
      (await handler(new Request(url, { headers: { Authorization: `Bearer ${token}` } }))).status,
      401,
    );
    mock.mock.restore();
  }
});

test('upstream failures never disclose tokens or raw errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error(token);
  });
  const result = await handler(new Request(url, { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: 'provider_unavailable' });
});

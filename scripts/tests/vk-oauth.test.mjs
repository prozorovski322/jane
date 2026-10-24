import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import authorize from '../../netlify/functions/vk-authorize.mjs';
import callback from '../../netlify/functions/vk-callback.mjs';
import token from '../../netlify/functions/vk-token.mjs';
import userinfo from '../../netlify/functions/vk-userinfo.mjs';
import { CLIENT_ID, CALLBACK, SUPABASE_CALLBACK } from '../../netlify/lib/vk.mjs';

const base = 'https://jane-english.netlify.app/.netlify/functions/';
const state = 'supabase-state-123456';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
function authRequest(overrides = {}) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: SUPABASE_CALLBACK,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    scope: 'email',
    ...overrides,
  });
  return new Request(`${base}vk-authorize?${p}`);
}
async function packedCode() {
  const response = await callback(
    new Request(
      `${CALLBACK}?${new URLSearchParams({ code: 'single-use-code', device_id: 'device-123', state })}`,
    ),
  );
  assert.equal(response.status, 302);
  const target = new URL(response.headers.get('location'));
  assert.equal(target.origin + target.pathname, SUPABASE_CALLBACK);
  assert.equal(target.searchParams.get('state'), state);
  return target.searchParams.get('code');
}
function tokenRequest(code, overrides = {}, basic = false) {
  const p = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: SUPABASE_CALLBACK,
    code_verifier: verifier,
    code,
    ...(basic ? {} : { client_id: CLIENT_ID }),
    ...overrides,
  });
  return new Request(`${base}vk-token`, {
    method: 'POST',
    body: p,
    ...(basic
      ? {
          headers: {
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:not-a-real-secret`).toString('base64')}`,
          },
        }
      : {}),
  });
}

test('authorization preserves PKCE and state, pins callback and requests only email', async () => {
  const result = await authorize(authRequest());
  assert.equal(result.status, 302);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
  const target = new URL(result.headers.get('location'));
  assert.equal(target.origin + target.pathname, 'https://id.vk.ru/authorize');
  assert.equal(target.searchParams.get('redirect_uri'), CALLBACK);
  assert.equal(target.searchParams.get('state'), state);
  assert.equal(target.searchParams.get('code_challenge'), challenge);
  assert.equal(target.searchParams.get('code_challenge_method'), 's256');
  assert.equal(target.searchParams.get('scope'), 'email');
});

test('authorization rejects downgraded PKCE, other apps, extra scopes and redirects', async () => {
  for (const bad of [
    { code_challenge_method: 'plain' },
    { code_challenge: '' },
    { state: '' },
    { redirect_uri: 'https://attacker.example' },
    { client_id: '1' },
    { scope: 'email phone' },
  ]) {
    assert.equal((await authorize(authRequest(bad))).status, 400);
  }
  assert.equal(
    (await authorize(new Request(`${authRequest().url}&state=second-state`))).status,
    400,
  );
});

test('callback transports device_id without treating it as a verified identity', async () => {
  const code = await packedCode();
  assert.deepEqual(JSON.parse(Buffer.from(code, 'base64url').toString()), {
    c: 'single-use-code',
    d: 'device-123',
    s: state,
  });
  for (const p of [
    { code: 'a', state },
    { code: 'a', device_id: 'd' },
    { code: 'a', device_id: 'd', state: 'bad\nstate' },
  ]) {
    assert.equal(
      (await callback(new Request(`${CALLBACK}?${new URLSearchParams(p)}`))).status,
      400,
    );
  }
});

test('cancelled authorization returns only a fixed error to Supabase', async () => {
  const result = await callback(
    new Request(
      `${CALLBACK}?${new URLSearchParams({ error: 'raw-secret-error', state, redirect_uri: 'https://attacker.example' })}`,
    ),
  );
  const target = new URL(result.headers.get('location'));
  assert.equal(target.origin + target.pathname, SUPABASE_CALLBACK);
  assert.equal(target.searchParams.get('error'), 'access_denied');
  assert.equal(target.searchParams.get('code'), null);
  assert.ok(!target.toString().includes('raw-secret'));
});

test('exchange forwards original verifier and device and strips ID/refresh tokens', async (t) => {
  const code = await packedCode();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://id.vk.ru/oauth2/auth');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('code'), 'single-use-code');
    assert.equal(options.body.get('device_id'), 'device-123');
    assert.equal(options.body.get('state'), state);
    assert.equal(options.body.get('redirect_uri'), CALLBACK);
    assert.equal(
      createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'),
      challenge,
    );
    assert.equal(options.body.get('client_secret'), null);
    return Response.json({
      state,
      access_token: 'valid-test-access-token',
      expires_in: 3600,
      id_token: 'unverified',
      refresh_token: 'not-needed',
    });
  });
  for (const basic of [false, true]) {
    const result = await token(tokenRequest(code, {}, basic));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      access_token: 'valid-test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }
});

test('wrong verifier cannot redeem the authorization code; upstream errors stay private', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.body.get('code_verifier') !== verifier)
      return Response.json({ error: 'invalid code_challenge', access_token: 'must-not-leak' });
    return Response.json({ state: 'wrong-state', access_token: 'must-not-leak', expires_in: 3600 });
  });
  for (const codeVerifier of [verifier, 'b'.repeat(43)]) {
    const result = await token(tokenRequest(await packedCode(), { code_verifier: codeVerifier }));
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { error: 'invalid_grant' });
  }
});

test('invalid exchange input fails without any provider request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('must not call');
  });
  const code = await packedCode();
  for (const bad of [
    { client_id: 'wrong' },
    { redirect_uri: 'https://attacker.example' },
    { code_verifier: '' },
    { grant_type: 'refresh_token' },
  ]) {
    assert.equal((await token(tokenRequest(code, bad))).status, 400);
  }
  for (const badCode of [
    'not-json',
    Buffer.from('null').toString('base64url'),
    Buffer.from('{"c":"c"}').toString('base64url'),
  ]) {
    assert.equal((await token(tokenRequest(badCode))).status, 400);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('userinfo verifies token at VK and returns only normalized profile with unverified email', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://id.vk.ru/oauth2/user_info');
    assert.equal(options.body.get('access_token'), 'valid-test-access-token');
    assert.equal(options.body.get('client_id'), CLIENT_ID);
    return Response.json({
      user: {
        user_id: '123',
        email: 'person@example.com',
        first_name: 'Artur',
        last_name: 'Belov',
        phone: 'private',
        avatar: 'private',
      },
    });
  });
  const result = await userinfo(
    new Request(`${base}vk-userinfo`, {
      headers: { Authorization: 'Bearer valid-test-access-token' },
    }),
  );
  assert.deepEqual(await result.json(), {
    sub: '123',
    email: 'person@example.com',
    email_verified: false,
    name: 'Artur Belov',
  });
});

test('userinfo rejects missing token, absent identity, missing email and upstream failures', async (t) => {
  assert.equal((await userinfo(new Request(`${base}vk-userinfo`))).status, 401);
  const request = () =>
    new Request(`${base}vk-userinfo`, {
      headers: { Authorization: 'Bearer valid-test-access-token' },
    });
  for (const payload of [
    { user: { user_id: '123' } },
    { user: { email: 'person@example.com' } },
    { error: 'secret' },
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    assert.equal((await userinfo(request())).status, 401);
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('secret');
  });
  assert.deepEqual(await (await userinfo(request())).json(), { error: 'invalid_token' });
});

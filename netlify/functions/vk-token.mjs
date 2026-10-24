import { Buffer } from 'node:buffer';
import {
  CALLBACK,
  CLIENT_ID,
  SUPABASE_CALLBACK,
  json,
  opaque,
  unique,
  vkPost,
} from '../lib/vk.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (
    !(request.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')
  ) {
    return json({ error: 'invalid_request' }, 400);
  }
  const body = await request.text();
  if (body.length > 16000) return json({ error: 'invalid_request' }, 400);
  const params = new URLSearchParams(body);
  const basic = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(request.headers.get('authorization') ?? '');
  const basicClient = basic ? Buffer.from(basic[1], 'base64').toString().split(':')[0] : null;
  const client = params.get('client_id') ?? basicClient;
  if (
    !unique(params) ||
    client !== CLIENT_ID ||
    (basicClient && basicClient !== CLIENT_ID) ||
    params.get('grant_type') !== 'authorization_code' ||
    params.get('redirect_uri') !== SUPABASE_CALLBACK ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(params.get('code_verifier') ?? '') ||
    !/^[A-Za-z0-9_-]{1,8192}$/.test(params.get('code') ?? '')
  ) {
    return json({ error: 'invalid_request' }, 400);
  }
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(params.get('code'), 'base64url').toString());
  } catch {
    return json({ error: 'invalid_grant' }, 400);
  }
  if (!envelope || !opaque(envelope.c) || !opaque(envelope.d, 1024) || !opaque(envelope.s)) {
    return json({ error: 'invalid_grant' }, 400);
  }
  try {
    const result = await vkPost(
      'auth',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: CALLBACK,
        code: envelope.c,
        device_id: envelope.d,
        state: envelope.s,
        code_verifier: params.get('code_verifier'),
      }),
    );
    if (
      result.state !== envelope.s ||
      !opaque(result.access_token, 8192) ||
      !Number.isInteger(result.expires_in) ||
      result.expires_in <= 0 ||
      result.expires_in > 31536000
    ) {
      return json({ error: 'invalid_grant' }, 400);
    }
    // No VK id_token is passed to Supabase: identity comes from authenticated
    // user_info below, not from decoding an unverified token or client payload.
    return json({
      access_token: result.access_token,
      token_type: 'Bearer',
      expires_in: result.expires_in,
    });
  } catch {
    return json({ error: 'invalid_grant' }, 400);
  }
}

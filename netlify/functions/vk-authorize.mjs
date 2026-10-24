import {
  CALLBACK,
  CLIENT_ID,
  SUPABASE_CALLBACK,
  json,
  opaque,
  redirect,
  unique,
} from '../lib/vk.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const params = new URL(request.url).searchParams;
  if (
    !unique(params) ||
    params.get('client_id') !== CLIENT_ID ||
    params.get('redirect_uri') !== SUPABASE_CALLBACK ||
    params.get('response_type') !== 'code' ||
    params.get('code_challenge_method') !== 'S256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') ?? '') ||
    !opaque(params.get('state')) ||
    params.get('scope') !== 'email'
  ) {
    return json({ error: 'invalid_request' }, 400);
  }
  const destination = new URL('https://id.vk.ru/authorize');
  destination.search = new URLSearchParams({
    client_id: CLIENT_ID,
    app_id: CLIENT_ID,
    redirect_uri: CALLBACK,
    response_type: 'code',
    scope: 'email',
    state: params.get('state'),
    code_challenge: params.get('code_challenge'),
    code_challenge_method: 's256',
  }).toString();
  return redirect(destination);
}

import { Buffer } from 'node:buffer';
import { SUPABASE_CALLBACK, json, opaque, redirect, unique } from '../lib/vk.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const params = new URL(request.url).searchParams;
  const state = params.get('state');
  if (!unique(params) || !opaque(state)) return json({ error: 'invalid_request' }, 400);
  const destination = new URL(SUPABASE_CALLBACK);
  destination.searchParams.set('state', state);
  if (params.has('error')) {
    destination.searchParams.set('error', 'access_denied');
    return redirect(destination);
  }
  const code = params.get('code');
  const deviceId = params.get('device_id');
  if (!opaque(code) || !opaque(deviceId, 1024)) return json({ error: 'invalid_request' }, 400);
  // This is a transport envelope, not a trusted identity or session. Supabase
  // validates state; VK validates the original single-use code against PKCE.
  const envelope = Buffer.from(JSON.stringify({ c: code, d: deviceId, s: state })).toString(
    'base64url',
  );
  destination.searchParams.set('code', envelope);
  return redirect(destination);
}

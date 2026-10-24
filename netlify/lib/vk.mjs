export const CLIENT_ID = '54849871';
export const CALLBACK = 'https://jane-english.netlify.app/.netlify/functions/vk-callback';
export const SUPABASE_CALLBACK = 'https://rfxzrleoebkipamwicrb.supabase.co/auth/v1/callback';

const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
export function json(body, status = 200) {
  return Response.json(body, { status, headers });
}
export function redirect(url) {
  return new Response(null, { status: 302, headers: { ...headers, Location: url.toString() } });
}
export function opaque(value, max = 2048) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    /^[\x21-\x7e]+$/.test(value)
  );
}
export function unique(params) {
  return new Set(params.keys()).size === [...params.keys()].length;
}
export async function vkPost(path, params) {
  const result = await fetch(`https://id.vk.ru/oauth2/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  const data = await result.json();
  if (!result.ok || !data || data.error) throw new Error('provider_error');
  return data;
}

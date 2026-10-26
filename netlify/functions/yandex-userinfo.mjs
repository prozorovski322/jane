// Public OAuth client identifier for Jane, never the client secret.
const JANE_CLIENT_ID = '6d6b261bc97b4f3eb5bc3e83ed05ccf8';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

// Supabase handles state, PKCE and code exchange. This endpoint only normalizes
// the profile fetched directly from Yandex using the resulting access token.
export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('authorization') ?? '';
  // OAuth 2.0 bearer tokens may also contain `+` and `/`, with optional
  // trailing `=` padding. Keep the value constrained to the RFC token
  // alphabet before forwarding it to Yandex.
  const match = /^(?:Bearer|OAuth) ([A-Za-z0-9._~+/-]{16,4096}={0,16})$/i.exec(authorization);
  if (!match) return json({ error: 'invalid_token' }, 401);
  let profile;
  try {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${match[1]}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) {
      return json(
        {
          error:
            response.status === 401 || response.status === 403
              ? 'invalid_token'
              : 'provider_unavailable',
        },
        response.status === 401 || response.status === 403 ? 401 : 502,
      );
    }
    profile = await response.json();
  } catch {
    // Never echo upstream bodies, tokens, or exception details.
    return json({ error: 'provider_unavailable' }, 502);
  }
  if (
    !profile ||
    profile.client_id !== JANE_CLIENT_ID ||
    typeof profile.id !== 'string' ||
    !/^[0-9]{1,32}$/.test(profile.id) ||
    typeof profile.default_email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.default_email) ||
    profile.default_email.length > 254
  ) {
    return json({ error: 'invalid_profile' }, 401);
  }
  return json({
    sub: profile.id,
    email: profile.default_email,
    // Yandex's JSON response does not assert email verification. Supabase must
    // perform its normal verification rather than trust or merge this address.
    email_verified: false,
    ...(typeof profile.real_name === 'string' ? { name: profile.real_name.slice(0, 200) } : {}),
  });
}

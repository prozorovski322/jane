import { CLIENT_ID, json, vkPost } from '../lib/vk.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const token = /^Bearer ([A-Za-z0-9._~-]{16,8192})$/i.exec(
    request.headers.get('authorization') ?? '',
  );
  if (!token) return json({ error: 'invalid_token' }, 401);
  try {
    const result = await vkPost(
      'user_info',
      new URLSearchParams({ client_id: CLIENT_ID, access_token: token[1] }),
    );
    const user = result.user;
    const subject = user?.user_id;
    if (
      !(typeof subject === 'string' && /^[0-9]{1,32}$/.test(subject)) ||
      typeof user.email !== 'string' ||
      user.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
    ) {
      return json({ error: 'invalid_profile' }, 401);
    }
    const name = [user.first_name, user.last_name]
      .filter((v) => typeof v === 'string')
      .join(' ')
      .slice(0, 200);
    return json({
      sub: subject,
      email: user.email,
      email_verified: false,
      ...(name ? { name } : {}),
    });
  } catch {
    return json({ error: 'invalid_token' }, 401);
  }
}

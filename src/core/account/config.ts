/**
 * Account settings, from environment variables baked in at build time (.env locally, the
 * hosting's environment variables for the website). Without them accounts are off and the app
 * works as before: everything stays on the device and no sign-in is asked for.
 *
 *   EXPO_PUBLIC_SUPABASE_URL        https://<project>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY   the project's publishable (anon) key; safe to ship
 *   EXPO_PUBLIC_AUTH_PROVIDERS      sign-in buttons besides e-mail, comma-separated:
 *                                   google, custom:yandex, custom:vk
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const accountsEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** Enable only after the Magic Link e-mail template contains both the code and sign-in link. */
export const emailPasswordlessEnabled = () => process.env.EXPO_PUBLIC_EMAIL_PASSWORDLESS === 'true';

export type OAuthProvider = 'google' | 'custom:yandex' | 'custom:vk';

const KNOWN: readonly OAuthProvider[] = ['google', 'custom:yandex', 'custom:vk'];

/** The sign-in buttons to show, in a fixed order. */
export function oauthProviders(
  list: string = process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? '',
): OAuthProvider[] {
  const wanted = new Set(list.split(',').map((s: string) => s.trim()));
  return KNOWN.filter((p) => wanted.has(p));
}

export const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Войти через Google',
  'custom:yandex': 'Войти с Яндекс ID',
  'custom:vk': 'Войти с VK ID',
};

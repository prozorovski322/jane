/**
 * The Supabase client, created on first use. The session is kept in the browser's storage on
 * the website and in expo-sqlite's key-value store in the app. Sign-in redirects (Google, Yandex,
 * VK, password reset) come back with a code that the client exchanges itself (PKCE).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { accountsEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!accountsEnabled()) throw new Error('Accounts are not configured');
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      ...(Platform.OS === 'web'
        ? {}
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          { storage: require('expo-sqlite/kv-store').default }),
    },
  });
  return client;
}

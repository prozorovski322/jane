/**
 * Account operations on top of Supabase: sign-in and sign-up, profile, friends, leaderboards and
 * progress sync. Error messages are turned into Russian sentences for the learner.
 */
import type { AuthError, PostgrestError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from '@/core/account/client';
import type { OAuthProvider } from '@/core/account/config';
import { dayOf } from '@/core/progress/dates';
import { exportSnapshot, importSnapshot, Snapshot } from '@/core/storage/backup';
import type { Db } from '@/core/storage/db';
import { mergeSnapshots, sameData } from '@/core/storage/merge';
import { SCHEMA_VERSION } from '@/core/storage/migrations';

export class AccountError extends Error {}

/** A message the learner understands, for an error from Supabase. */
export function accountMessage(e: AuthError | PostgrestError | Error | null | undefined): string {
  const text = e?.message ?? '';
  if (/invalid login credentials/i.test(text)) return 'Неверная почта или пароль.';
  if (/email not confirmed/i.test(text))
    return 'Почта ещё не подтверждена. Откройте письмо от Jane и нажмите на ссылку в нём.';
  if (
    /token.*expired|token.*invalid|otp.*expired|otp.*invalid|email link.*(?:expired|invalid)/i.test(
      text,
    )
  )
    return 'Код или ссылка недействительны либо уже использованы. Запросите новое письмо.';
  if (/already registered|already been registered|user already exists/i.test(text))
    return 'Эта почта уже зарегистрирована. Войдите или восстановите пароль.';
  if (/password should be at least|weak password/i.test(text))
    return 'Пароль слишком простой: нужно не меньше 8 символов.';
  if (/rate limit|too many requests|security purposes/i.test(text))
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  if (/invalid email|unable to validate email/i.test(text)) return 'Проверьте адрес почты.';
  if (/failed to fetch|network/i.test(text))
    return 'Нет связи с сервером. Проверьте подключение к интернету.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

function check<R extends { data: unknown; error: AuthError | PostgrestError | null }>(
  r: R,
): R['data'] {
  if (r.error) throw new AccountError(accountMessage(r.error));
  return r.data;
}

/** Where sign-in and password e-mails send the learner back to. */
function siteUrl(path: string) {
  return Platform.OS === 'web' && typeof location !== 'undefined'
    ? `${location.origin}${path}`
    : `jane://${path.replace(/^\//, '')}`;
}

export const MIN_PASSWORD = 8;

export async function signIn(email: string, password: string) {
  check(await supabase().auth.signInWithPassword({ email: email.trim(), password }));
}

/** Existing accounts only: new learners register with a name and privacy consent first. */
export async function sendEmailSignIn(email: string) {
  check(
    await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: siteUrl('/') },
    }),
  );
}

export async function verifyEmailCode(email: string, code: string) {
  check(
    await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }),
  );
}

/** The link opens a confirmation screen; loading or previewing it never consumes the token. */
export async function verifyEmailLink(tokenHash: string) {
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(tokenHash))
    throw new AccountError('Ссылка недействительна. Запросите новое письмо на экране входа.');
  check(await supabase().auth.verifyOtp({ token_hash: tokenHash, type: 'email' }));
}

/** Returns true when the account still needs its e-mail confirmed. */
export async function signUp(email: string, password: string, name: string): Promise<boolean> {
  const data = check(
    await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: siteUrl('/'),
      },
    }),
  );
  return !data.session;
}

export async function signInWith(provider: OAuthProvider) {
  check(
    await supabase().auth.signInWithOAuth({
      provider: provider as Parameters<
        ReturnType<typeof supabase>['auth']['signInWithOAuth']
      >[0]['provider'],
      options: { redirectTo: siteUrl('/') },
    }),
  );
}

export async function sendPasswordReset(email: string) {
  check(
    await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl('/new-password'),
    }),
  );
}

export async function setNewPassword(password: string) {
  check(await supabase().auth.updateUser({ password }));
}

export async function signOut() {
  await supabase().auth.signOut();
}

export async function deleteAccount() {
  check(await supabase().rpc('delete_account'));
  await supabase().auth.signOut();
}

// Profile ----------------------------------------------------------------------------------

export interface Profile {
  id: string;
  display_name: string;
  friend_code: string;
  plan: 'free' | 'premium';
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  return check(
    await supabase()
      .from('profiles')
      .select('id, display_name, friend_code, plan')
      .eq('id', userId)
      .maybeSingle<Profile>(),
  );
}

export async function renameProfile(userId: string, name: string) {
  check(
    await supabase()
      .from('profiles')
      .update({ display_name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', userId),
  );
}

// Friends and leaderboards -----------------------------------------------------------------

/** Adds the owner of a friend code. Returns their name, or null if the code is unknown. */
export async function addFriend(code: string): Promise<string | null> {
  return check(await supabase().rpc('add_friend', { code: code.trim() })) as string | null;
}

export async function removeFriend(friendId: string) {
  check(await supabase().rpc('remove_friend', { friend: friendId }));
}

export interface LeaderRow {
  user_id?: string;
  display_name: string;
  week_xp: number;
  streak?: number;
  is_me: boolean;
}

export async function friendsLeaderboard(): Promise<LeaderRow[]> {
  return (check(await supabase().rpc('friends_leaderboard')) as LeaderRow[] | null) ?? [];
}

export async function globalLeaderboard(): Promise<LeaderRow[]> {
  return (
    (check(await supabase().rpc('global_leaderboard', { lim: 50 })) as LeaderRow[] | null) ?? []
  );
}

// Sync ---------------------------------------------------------------------------------------

/** Monday of the current week (UTC), as the server counts weeks. */
export function weekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** XP of all time and of this week, from the learner's daily activity. */
export async function xpStats(db: Db, now = new Date()) {
  const since = weekStart(now);
  const row = await db.get<{ total: number | null; week: number | null }>(
    'SELECT SUM(xp) AS total, SUM(CASE WHEN day >= ? THEN xp ELSE 0 END) AS week FROM daily_activity',
    [since],
  );
  return { total: row?.total ?? 0, week: row?.week ?? 0, weekStart: since, today: dayOf(now) };
}

export type SyncResult = 'merged' | 'unchanged' | 'outdated';

/**
 * Exchanges progress with the account: the account's snapshot is merged into this device (no
 * side loses anything), the result is stored in the account, and the leaderboard stats updated.
 */
export async function syncProgress(
  db: Db,
  userId: string,
  streak: number,
  now = new Date(),
): Promise<SyncResult> {
  const sb = supabase();
  const row = check(
    await sb
      .from('progress')
      .select('schema, snapshot')
      .eq('user_id', userId)
      .maybeSingle<{ schema: number; snapshot: unknown }>(),
  );
  // Saved by a newer version of the app: leave it alone until this one is updated.
  if (row && row.schema > SCHEMA_VERSION) return 'outdated';

  const local = await exportSnapshot(db, now);
  const parsed = row ? Snapshot.safeParse(row.snapshot) : null;
  const remote = parsed?.success ? parsed.data : null;
  const merged = remote ? mergeSnapshots(local, remote, now) : local;

  const localChanged = !sameData(merged, local);
  if (localChanged) await importSnapshot(db, merged);
  if (!remote || !sameData(merged, remote)) {
    check(
      await sb.from('progress').upsert({
        user_id: userId,
        schema: merged.schema,
        snapshot: merged,
        updated_at: now.toISOString(),
      }),
    );
  }

  const xp = await xpStats(db, now);
  check(
    await sb.from('stats').upsert({
      user_id: userId,
      total_xp: xp.total,
      week_xp: xp.week,
      week_start: xp.weekStart,
      streak,
      updated_at: now.toISOString(),
    }),
  );
  return localChanged ? 'merged' : 'unchanged';
}

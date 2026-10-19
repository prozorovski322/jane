/**
 * Keeps the app behind sign-in when accounts are on: everything except the sign-in screens and
 * the privacy policy sends a signed-out learner to /auth. After signing in on a new device it
 * waits for the first sync, so the learner's progress (and finished onboarding) arrive before
 * anything is shown. Renders nothing when accounts are off.
 */
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { useOnboarding } from '../onboarding/store';
import { useAccount } from './store';

/** Routes a signed-out visitor may open. */
export const PUBLIC_ROUTES = new Set(['auth', 'new-password', 'privacy']);

export function AccountGate() {
  const { colors } = useTheme();
  const status = useAccount((s) => s.status);
  const recovering = useAccount((s) => s.recovering);
  const firstSyncPending = useAccount(
    (s) => s.status === 'signed-in' && s.lastSyncedAt === null && !s.syncError,
  );
  const onboarded = useOnboarding((s) => s.data?.done);
  const segments = useSegments();
  const first = segments[0] ?? '';

  useEffect(() => {
    if (status === 'signed-out' && !PUBLIC_ROUTES.has(first)) router.replace('/auth');
    else if (status !== 'signed-in' || firstSyncPending) return;
    else if (recovering && first !== 'new-password') router.replace('/new-password');
    else if (!recovering && first === 'auth') router.replace('/');
    // The account brought a finished onboarding from another device.
    else if (onboarded && first === 'onboarding') router.replace('/');
  }, [status, recovering, first, firstSyncPending, onboarded]);

  if (status !== 'loading' && !firstSyncPending) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}
      aria-live="polite"
    >
      <AppText variant="bodyStrong" color="primary">
        {status === 'loading' ? 'Проверяем вход…' : 'Загружаем ваш прогресс…'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

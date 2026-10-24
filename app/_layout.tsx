import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { configureNotifications, syncReminders } from '@/core/notifications/reminders';
import { registerNativeRecognizer } from '@/core/speech/native-stt';
import { registerWebRecognizer } from '@/core/speech/web-stt';
import { initDatabase } from '@/core/storage';
import { storageBootMessage } from '@/core/storage/web-db-lock';
import { useOnboarding } from '@/features/onboarding/store';
import { useProgress } from '@/features/progress/store';
import { bindSettings, useSettings } from '@/features/settings/store';
import { AccountGate } from '@/features/account/AccountGate';
import { useAccount } from '@/features/account/store';
import { usePageTitle } from '@/lib/pageTitle';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { FONT_FILES } from '@/ui/theme/fontFiles';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/** Opens and migrates the database, then loads settings and progress. */
function useBoot() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let unbind: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        // The website uses the browser's recognizer; the app, the native one (development/store
        // builds only). Where neither exists, speaking exercises stay in self-check mode.
        if (Platform.OS === 'web') registerWebRecognizer();
        else registerNativeRecognizer();
        const db = await initDatabase();
        unbind = await bindSettings(db);
        await useOnboarding.getState().load(db);
        await useProgress.getState().refresh(db);
        // Reads the saved session only (no network); sync starts in the background.
        await useAccount.getState().init();
        configureNotifications();
        void syncReminders(db);
        if (alive) setBoot({ status: 'ready' });
      } catch (e) {
        if (alive)
          setBoot({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
      unbind?.();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    // Failed OPFS initialization leaves the SDK worker unusable. Re-running
    // openDatabase in that worker cannot recover it; reload creates a new worker.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    setBoot({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { boot, retry };
}

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <AppText variant="title" align="center">
        Не удалось открыть данные приложения
      </AppText>
      <AppText variant="small" color="textMuted" align="center">
        {storageBootMessage(message)}
      </AppText>
      <Button
        label={Platform.OS === 'web' ? 'Обновить страницу' : 'Попробовать ещё раз'}
        onPress={onRetry}
      />
    </View>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  usePageTitle();
  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen
          name="lesson/[id]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="review"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="practice/[kind]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="placement"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
      </Stack>
      <AccountGate />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

function WebLoading() {
  return (
    <View style={[styles.center, { backgroundColor: '#000000' }]}>
      <Text style={{ color: '#B69CFF', fontSize: 17, fontWeight: '600' }}>
        Загружаем курс…
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const fontScale = useSettings((s) => s.fontScale);
  const { boot, retry } = useBoot();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // If fonts fail to load the app still works with system fonts. The website does not wait for
  // them at all: text shows in a system font and switches when the fonts arrive.
  const fontsDone = Platform.OS === 'web' || fontsLoaded || !!fontError;
  const ready = fontsDone && boot.status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // The website has no native splash screen: while the database opens, say so instead of a blank
  // page (index.html shows the same while the script downloads).
  if (!ready) return Platform.OS === 'web' ? <WebLoading /> : null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider preference={theme} fontScale={fontScale}>
        {boot.status === 'error' ? (
          <BootError message={boot.message} onRetry={retry} />
        ) : (
          <ThemedStack />
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});

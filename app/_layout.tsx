import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { GolosText_400Regular } from '@expo-google-fonts/golos-text/400Regular';
import { GolosText_500Medium } from '@expo-google-fonts/golos-text/500Medium';
import { GolosText_600SemiBold } from '@expo-google-fonts/golos-text/600SemiBold';
import { GolosText_700Bold } from '@expo-google-fonts/golos-text/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { registerNativeRecognizer } from '@/core/speech/native-stt';
import { initDatabase } from '@/core/storage';
import { useOnboarding } from '@/features/onboarding/store';
import { useProgress } from '@/features/progress/store';
import { bindSettings, useSettings } from '@/features/settings/store';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
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
        // Speech recognition exists only in a development/store build; elsewhere this is a no-op.
        registerNativeRecognizer();
        const db = await initDatabase();
        unbind = await bindSettings(db);
        await useOnboarding.getState().load(db);
        await useProgress.getState().refresh(db);
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
        {message}
      </AppText>
      <Button label="Попробовать ещё раз" onPress={onRetry} />
    </View>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
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
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const { boot, retry } = useBoot();
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    GolosText_400Regular,
    GolosText_500Medium,
    GolosText_600SemiBold,
    GolosText_700Bold,
  });
  // If fonts fail to load the app still works with system fonts.
  const fontsDone = fontsLoaded || !!fontError;
  const ready = fontsDone && boot.status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider preference={theme}>
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

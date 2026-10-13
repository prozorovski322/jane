import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { GolosText_400Regular } from '@expo-google-fonts/golos-text/400Regular';
import { GolosText_500Medium } from '@expo-google-fonts/golos-text/500Medium';
import { GolosText_600SemiBold } from '@expo-google-fonts/golos-text/600SemiBold';
import { GolosText_700Bold } from '@expo-google-fonts/golos-text/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSettings } from '@/features/settings/store';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

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
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const [loaded, error] = useFonts({
    Unbounded_600SemiBold,
    GolosText_400Regular,
    GolosText_500Medium,
    GolosText_600SemiBold,
    GolosText_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  // If fonts fail to load the app still works with system fonts.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider preference={theme}>
        <ThemedStack />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

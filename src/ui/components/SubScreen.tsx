import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export function goBack(fallback: '/' | '/dictionary' | '/practice' = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** A pushed screen with a back button and a title. */
export function SubScreen({
  title,
  right,
  children,
  fallback,
  footer,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  fallback?: Parameters<typeof goBack>[0];
  footer?: ReactNode;
}) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.bar, { paddingHorizontal: space.xs }]}>
        <IconButton icon="back" label="Назад" color="text" onPress={() => goBack(fallback)} />
        <AppText variant="heading" role="heading" style={styles.flex} numberOfLines={1}>
          {title}
        </AppText>
        {right}
      </View>
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { padding: space.md, gap: space.md }]}
      >
        {children}
      </ScrollView>
      {footer && (
        <View style={[styles.footer, { padding: space.md, borderTopColor: colors.border }]}>
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 48 },
  footer: { borderTopWidth: 1, gap: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
});

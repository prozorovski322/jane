import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/ui/components/AppText';
import { Mascot } from '@/ui/components/Mascot';
import { useTheme } from '@/ui/theme/ThemeProvider';

export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { padding: space.lg, gap: space.md }]}
      >
        <View style={styles.brand}>
          <Mascot size={72} />
          <AppText variant="display">Jane</AppText>
        </View>
        <AppText variant="title" role="heading">
          {title}
        </AppText>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingBottom: 48 },
  brand: { alignItems: 'center', gap: 8, paddingVertical: 8 },
});

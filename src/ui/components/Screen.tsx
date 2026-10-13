import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/** A scrolling screen with a large title; content is capped in width on tablets. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  edges = ['top'],
  ...scroll
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
} & ScrollViewProps) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={edges}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        {...scroll}
        contentContainerStyle={[styles.content, { padding: space.md, gap: space.md }]}
      >
        {title && (
          <View style={styles.header}>
            <View style={styles.flex}>
              <AppText variant="display" role="heading">
                {title}
              </AppText>
              {subtitle && (
                <AppText variant="small" color="textMuted">
                  {subtitle}
                </AppText>
              )}
            </View>
            {right}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" role="heading" style={styles.flex}>
        {children}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  flex: { flex: 1 },
});

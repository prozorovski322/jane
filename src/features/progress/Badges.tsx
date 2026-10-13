import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Icon } from '@/ui/components/Icon';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { useProgress } from './store';

/** Streak and XP, compact, for screen headers. */
export function StreakXp() {
  const { colors, radius } = useTheme();
  const snap = useProgress((s) => s.snapshot);
  if (!snap) return null;
  return (
    <View style={styles.row} accessible aria-label={`Серия ${snap.streak}, опыт ${snap.totalXp}`}>
      <View
        style={[styles.badge, { backgroundColor: colors.accentSoft, borderRadius: radius.pill }]}
      >
        <Icon name="flame" size={18} color={colors.accent} />
        <AppText variant="smallStrong" color="accent">
          {snap.streak}
        </AppText>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.xpSoft, borderRadius: radius.pill }]}>
        <AppText variant="smallStrong" color="xp">
          {snap.totalXp} XP
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

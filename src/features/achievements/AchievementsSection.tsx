import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { GROUP_LABEL, type AchievementGroup, type AchievementState } from './definitions';
import { evaluateAchievements, loadAchievements } from './service';

function Tile({ a }: { a: AchievementState }) {
  const { colors, radius } = useTheme();
  const unlocked = a.unlockedAt !== null;
  const label = unlocked
    ? `${a.title}. Получено. ${a.description}`
    : `${a.title}. ${a.description} Прогресс: ${a.value} из ${a.target}.`;
  return (
    <View
      style={[
        styles.tile,
        {
          borderRadius: radius.lg,
          borderColor: unlocked ? colors.xp : colors.border,
          backgroundColor: unlocked ? colors.xpSoft : colors.surface,
        },
      ]}
      accessible
      aria-label={label}
    >
      <View
        style={[styles.icon, { backgroundColor: unlocked ? colors.xp : colors.surfaceAlt }]}
        aria-hidden
      >
        <Icon
          name={unlocked ? a.icon : 'lock'}
          size={22}
          color={unlocked ? colors.surface : colors.textMuted}
        />
      </View>
      <AppText variant="smallStrong" align="center" color={unlocked ? 'text' : 'textMuted'}>
        {a.title}
      </AppText>
      <AppText variant="caption" color="textMuted" align="center" numberOfLines={3}>
        {a.description}
      </AppText>
      {!unlocked && a.target > 1 && <ProgressBar value={a.value / a.target} label={a.title} />}
    </View>
  );
}

/** All achievements by group; unlocked ones are highlighted, locked ones show progress. */
export function AchievementsSection() {
  const { colors } = useTheme();
  const data = useDbQuery(async (db) => {
    // Opening the list also unlocks what the dictionary or placement test may have earned.
    await evaluateAchievements(db);
    return loadAchievements(db);
  }, []);
  const list = data ? data : null;
  if (!list) return null;

  const groups = [...new Set(list.map((a) => a.group))] as AchievementGroup[];
  const unlocked = list.filter((a) => a.unlockedAt !== null).length;
  return (
    <Card>
      <View style={styles.header}>
        <Icon name="trophy" size={20} color={colors.xp} />
        <AppText variant="smallStrong" color="textMuted">
          Получено {unlocked} из {list.length}
        </AppText>
      </View>
      {groups.map((g) => (
        <Fragment key={g}>
          <AppText variant="smallStrong" role="heading" style={styles.group}>
            {GROUP_LABEL[g]}
          </AppText>
          <View style={styles.grid}>
            {list
              .filter((a) => a.group === g)
              .map((a) => (
                <Tile key={a.id} a={a} />
              ))}
          </View>
        </Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    borderWidth: 2,
    padding: 10,
    gap: 4,
    alignItems: 'center',
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

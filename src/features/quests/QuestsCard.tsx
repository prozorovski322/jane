import { StyleSheet, View } from 'react-native';

import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { ALL_QUESTS_BONUS } from './quests';
import { loadDayQuests } from './service';

/** The day's three optional quests with their progress. */
export function QuestsCard() {
  const { colors } = useTheme();
  const data = useDbQuery((db) => loadDayQuests(db), []);
  const quests = data ? data.quests : null;
  const allDone = data ? data.allDone : false;
  if (!quests) return null;

  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="heading" style={styles.flex}>
          Задания дня
        </AppText>
        <AppText variant="smallStrong" color="textMuted">
          {quests.filter((q) => q.done).length} из {quests.length}
        </AppText>
      </View>
      {quests.map(({ quest, progress, done }) => (
        <View
          key={quest.id}
          style={styles.quest}
          accessible
          aria-label={`${quest.title}. ${done ? 'Сделано' : quest.kind === 'accuracy' ? 'Не сделано' : `${progress} из ${quest.target}`}. Награда ${quest.xp} опыта.`}
        >
          <View
            style={[
              styles.mark,
              { backgroundColor: done ? colors.successSoft : colors.surfaceAlt },
            ]}
          >
            {done && <Icon name="check" size={16} color={colors.success} />}
          </View>
          <View style={styles.flex}>
            <AppText variant="small" color={done ? 'textMuted' : 'text'}>
              {quest.title}
            </AppText>
            {!done && quest.kind !== 'accuracy' && quest.target > 1 && (
              <ProgressBar value={progress / quest.target} label={quest.title} />
            )}
          </View>
          <AppText variant="caption" color="xp">
            +{quest.xp} XP
          </AppText>
        </View>
      ))}
      <AppText variant="caption" color="textMuted">
        {allDone
          ? `Все задания выполнены, бонус +${ALL_QUESTS_BONUS} XP получен.`
          : `Необязательно. За все три — ещё +${ALL_QUESTS_BONUS} XP.`}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

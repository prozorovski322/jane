import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { getCourse } from '@/core/content';
import { LEVEL_LABEL } from '@/core/content/schema';
import { isMastered } from '@/core/srs/scheduler';
import { allCards } from '@/core/storage/srs-repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { useAccount } from '../account/store';
import { GOALS, useOnboarding } from '../onboarding/store';
import { KIND_LABEL } from '../path/kinds';
import { useProgress } from '../progress/store';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Icon, type IconName } from '@/ui/components/Icon';
import { Mascot } from '@/ui/components/Mascot';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { learningOverview } from './overview';

export function LearningOverview() {
  const { colors } = useTheme();
  const compact = useWindowDimensions().width < 480;
  const snapshot = useProgress((s) => s.snapshot);
  const name = useAccount((s) => s.profile?.display_name);
  const goal = useOnboarding((s) => s.data?.goal);
  const overview = useMemo(
    () => learningOverview(getCourse(), snapshot?.completedLessons ?? new Set()),
    [snapshot?.completedLessons],
  );
  const learned = useDbQuery(
    async (db) => (await allCards(db, 'word')).filter(isMastered).length,
    [],
  );
  const level = overview.current ? LEVEL_LABEL[overview.current.level] : null;
  const stats: {
    label: string;
    value: string | number;
    icon: IconName;
    tone: 'primary' | 'info' | 'accent';
  }[] = [
    {
      label: 'уроков пройдено',
      value: snapshot ? overview.totalDone : '…',
      icon: 'book',
      tone: 'primary',
    },
    { label: 'слов освоено', value: learned ?? '…', icon: 'cards', tone: 'info' },
    { label: 'дней подряд', value: snapshot?.streak ?? '…', icon: 'flame', tone: 'accent' },
  ];
  return (
    <Appear>
      <View style={styles.stack}>
        <Card tone="primarySoft" style={styles.hero}>
          <View style={styles.heading}>
            <View style={styles.flex}>
              <AppText variant="caption" color="primary">
                ВАШ АНГЛИЙСКИЙ
              </AppText>
              <AppText variant={compact ? 'heading' : 'title'}>
                {name ? `С возвращением, ${name.split(' ')[0]}!` : 'Начнём с малого'}
              </AppText>
              <AppText variant="small" color="textMuted">
                {goal ? GOALS[goal] : 'Небольшие занятия. Заметный прогресс.'}
              </AppText>
            </View>
            <View aria-hidden>
              <Mascot size={compact ? 56 : 76} emotion="joy" />
            </View>
          </View>
          {snapshot && level && (
            <>
              <View style={styles.heading}>
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <AppText variant="smallStrong" color="primary">
                    {level}
                  </AppText>
                </View>
                <AppText variant="smallStrong" style={styles.flex}>
                  Пройдено {Math.round(overview.ratio * 100)}% уровня
                </AppText>
              </View>
              <ProgressBar value={overview.ratio} label={`Прогресс уровня ${level}`} />
              <AppText variant="caption" color="textMuted">
                {overview.done} из {overview.total} уроков уровня · {snapshot.totalXp} XP всего
              </AppText>
            </>
          )}
        </Card>
        <View style={styles.stats}>
          {stats.map((s) => (
            <Card key={s.label} style={styles.stat}>
              <Icon name={s.icon} color={colors[s.tone]} size={22} />
              <AppText variant="title">{s.value}</AppText>
              <AppText variant="caption" color="textMuted">
                {s.label}
              </AppText>
            </Card>
          ))}
        </View>
        {snapshot && overview.next && (
          <Card>
            <AppText variant="caption" color="primary">
              СЛЕДУЮЩИЙ УРОК
            </AppText>
            <AppText variant="heading">{overview.next.node.title}</AppText>
            <AppText variant="small" color="textMuted">
              {KIND_LABEL[overview.next.node.kind] ?? 'Практика'} · подсказки и разбор ответов
            </AppText>
            <Button
              label="Продолжить обучение"
              icon="arrow-right"
              onPress={() => router.push(`/lesson/${overview.next!.node.id}`)}
            />
          </Card>
        )}
        {snapshot && !overview.next && (
          <Card tone="primarySoft">
            <AppText variant="heading">Все уроки курса пройдены</AppText>
            <Button label="Перейти к повторению" onPress={() => router.push('/review')} />
          </Card>
        )}
      </View>
    </Appear>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 16 },
  hero: { gap: 16, padding: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  badge: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, flexBasis: 90, gap: 6, padding: 14 },
});

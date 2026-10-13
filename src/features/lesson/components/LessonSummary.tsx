import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { feedback } from '@/core/feedback/feedback';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { useTheme } from '@/ui/theme/ThemeProvider';

import type { LessonSummary as Summary } from '../engine';

function minutes(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  return `${m} мин`;
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

export function LessonSummary({
  summary,
  isTest,
  passScore,
  onDone,
}: {
  summary: Summary;
  isTest: boolean;
  passScore?: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const passed = !isTest || summary.score >= (passScore ?? 0);
  useEffect(() => {
    feedback.celebrate();
  }, []);

  const mistakes = summary.answered - summary.correctFirstTry;
  return (
    <View style={styles.wrap}>
      <Appear
        variant="zoom"
        duration={300}
        style={[styles.badge, { backgroundColor: colors.primarySoft }]}
      >
        <Icon name="check" size={56} color={colors.primary} />
      </Appear>
      <AppText variant="display" align="center" role="heading">
        {isTest ? (passed ? 'Тест пройден' : 'Тест завершён') : 'Урок пройден!'}
      </AppText>
      <AppText variant="body" color="textMuted" align="center">
        {mistakes === 0
          ? 'Без единой ошибки с первого раза.'
          : `Ошибок с первой попытки: ${mistakes}. Эти слова и правила чаще появятся в повторении.`}
        {isTest && !passed
          ? ` Чтобы засчитать тест, нужно ${Math.round((passScore ?? 0) * 100)}% — попробуйте ещё раз, когда будете готовы.`
          : ''}
      </AppText>
      <View style={styles.stats}>
        <Stat label="точность" value={`${Math.round(summary.accuracy * 100)}%`} />
        <Stat label="время" value={minutes(summary.durationMs)} />
        <Stat label="заданий" value={String(summary.answered)} />
      </View>
      {summary.skipped > 0 && (
        <AppText variant="small" color="textMuted" align="center">
          Пропущено заданий на слух или речь: {summary.skipped}. Они не влияют на результат.
        </AppText>
      )}
      <Button label="Продолжить" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  badge: {
    alignSelf: 'center',
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 2, padding: 12, alignItems: 'center', gap: 2 },
});

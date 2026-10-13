import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { feedback } from '@/core/feedback/feedback';
import type { SessionKind } from '@/core/progress/xp';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import type { CompletionInfo } from '../../progress/service';
import type { LessonSummary as Summary } from '../engine';

export type SaveState =
  | { status: 'idle' | 'saving' }
  | { status: 'saved'; info: CompletionInfo }
  | { status: 'error'; message: string };

function minutes(ms: number): string {
  return `${Math.max(1, Math.round(ms / 60000))} мин`;
}

function days(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'xp' | 'accent' }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
      accessible
      aria-label={`${label}: ${value}`}
    >
      <AppText variant="title" color={color ?? 'text'}>
        {value}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

export function LessonSummary({
  summary,
  kind,
  passScore,
  save,
  onRetrySave,
  onDone,
}: {
  summary: Summary;
  kind: SessionKind;
  passScore?: number;
  /** null when the session is not saved at all (e.g. in tests or previews). */
  save: SaveState | null;
  onRetrySave: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const info = save?.status === 'saved' ? save.info : null;
  const isTest = kind === 'test';
  const passed = info ? info.passed : !isTest || summary.score >= (passScore ?? 0);

  useEffect(() => {
    feedback.celebrate();
  }, []);

  const mistakes = summary.answered - summary.correctFirstTry;
  const title = isTest
    ? passed
      ? 'Тест пройден'
      : 'Тест завершён'
    : kind === 'review'
      ? 'Повторение готово'
      : 'Урок пройден!';

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
        {title}
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
        <Stat label="опыт" value={info ? `+${info.xp}` : '…'} color="xp" />
        <Stat label="точность" value={`${Math.round(summary.accuracy * 100)}%`} />
        <Stat label="время" value={minutes(summary.durationMs)} />
      </View>

      {info && (
        <View style={styles.block}>
          <View style={styles.row}>
            <AppText variant="smallStrong">Цель дня</AppText>
            <AppText variant="small" color="textMuted">
              {Math.min(info.todayXp, info.goalXp)} / {info.goalXp} XP
            </AppText>
          </View>
          <ProgressBar value={Math.min(1, info.todayXp / info.goalXp)} label="Цель дня" />
          <AppText
            variant="small"
            color={info.streakExtended ? 'accent' : 'textMuted'}
            aria-live="polite"
          >
            {info.goalJustReached ? 'Цель дня выполнена! ' : ''}
            {info.streakExtended
              ? `Серия: ${days(info.streak)} подряд.`
              : `Серия: ${days(info.streak)}.`}
            {info.freezeEarned
              ? ' Вы заработали заморозку серии — она сохранит серию, если пропустите день.'
              : ''}
          </AppText>
        </View>
      )}

      {save?.status === 'saving' && <ActivityIndicator accessibilityLabel="Сохраняю результат" />}
      {save?.status === 'error' && (
        <View style={styles.block}>
          <AppText variant="small" color="error" role="alert">
            Не удалось сохранить результат: {save.message}
          </AppText>
          <Button label="Попробовать ещё раз" variant="secondary" onPress={onRetrySave} />
        </View>
      )}

      {summary.skipped > 0 && (
        <AppText variant="small" color="textMuted" align="center">
          Пропущено заданий на слух или речь: {summary.skipped}. Они не влияют на результат.
        </AppText>
      )}
      <Button label="Продолжить" disabled={save?.status === 'saving'} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
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
  block: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

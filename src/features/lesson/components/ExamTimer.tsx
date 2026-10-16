/**
 * Exam timing for a long turn (IELTS Speaking Part 2): a minute to prepare, then up to two minutes
 * to speak. It only helps the learner practise the pace; it does not affect the score.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { feedback } from '@/core/feedback/feedback';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

type Phase = 'idle' | 'prepare' | 'speak' | 'done';

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function ExamTimer({ prepare, speak }: { prepare: number; speak: number }) {
  const { colors, radius, space } = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const start = (next: Phase) => {
    const seconds = next === 'prepare' ? prepare : speak;
    setPhase(next);
    setNow(Date.now());
    setEndsAt(Date.now() + seconds * 1000);
  };

  // Ticks while a phase runs; the time left is computed from the clock, so it stays exact. When a
  // phase runs out, preparation moves on to speaking and speaking ends.
  useEffect(() => {
    if (phase !== 'prepare' && phase !== 'speak') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < endsAt) return;
      void feedback.correct();
      if (phase === 'prepare') {
        setPhase('speak');
        setEndsAt(t + speak * 1000);
      } else {
        setPhase('done');
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, endsAt, speak]);

  const total = phase === 'prepare' ? prepare : speak;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: space.md,
        },
      ]}
    >
      {phase === 'idle' && (
        <>
          <AppText variant="small" color="textMuted">
            Как на экзамене: {clock(prepare)} на подготовку и заметки, потом до {clock(speak)} речи.
          </AppText>
          <Button
            label="Засечь время, как на экзамене"
            icon="clock"
            variant="secondary"
            compact
            onPress={() => start(prepare > 0 ? 'prepare' : 'speak')}
          />
        </>
      )}
      {(phase === 'prepare' || phase === 'speak') && (
        <>
          <View style={styles.row}>
            <AppText variant="bodyStrong">
              {phase === 'prepare' ? 'Подготовка: набросайте ключевые слова' : 'Говорите'}
            </AppText>
            <AppText variant="heading" aria-live="off" accessibilityLabel={`Осталось ${left} с`}>
              {clock(left)}
            </AppText>
          </View>
          {/* The bar stretches along a row (flex: 1). */}
          <View style={styles.row}>
            <ProgressBar value={total ? 1 - left / total : 1} label="Время" />
          </View>
          <Button
            label={phase === 'prepare' ? 'Готов(а) говорить' : 'Закончил(а)'}
            variant="ghost"
            compact
            onPress={() => (phase === 'prepare' ? start('speak') : setPhase('done'))}
          />
        </>
      )}
      {phase === 'done' && (
        <>
          <AppText variant="bodyStrong" aria-live="polite">
            {left === 0
              ? 'Время вышло. На экзамене здесь экзаменатор вас остановит.'
              : 'Готово. Сравните свой ответ с образцом.'}
          </AppText>
          <Button
            label="Ещё раз"
            icon="refresh"
            variant="ghost"
            compact
            onPress={() => start('prepare')}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { shuffledIndexes } from '@/lib/random';
import { AppText } from '@/ui/components/AppText';
import type { ChoiceState } from '@/ui/components/Choice';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** The short task line above an exercise: «Выберите перевод». */
export function Instruction({ children }: { children: string }) {
  return (
    <AppText variant="heading" role="heading">
      {children}
    </AppText>
  );
}

/** The phrase the exercise is about; English phrases get play buttons. */
export function Prompt({ text, lang, cue }: { text: string; lang: 'en' | 'ru'; cue?: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={[
        styles.prompt,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: space.md,
        },
      ]}
    >
      {lang === 'en' && <SpeakButtons text={text} />}
      <View style={styles.flex}>
        <AppText variant="prompt">{text}</AppText>
        {cue && (
          <AppText variant="small" color="textMuted">
            {cue}
          </AppText>
        )}
      </View>
    </View>
  );
}

/** Seeded display order: position → original index. */
export function useOrder(n: number, seed: string): number[] {
  return useMemo(() => shuffledIndexes(n, seed), [n, seed]);
}

/** Visual state of an option once the exercise has been checked. */
export function optionState(
  index: number,
  selected: number | null,
  correct: number,
  checked: boolean,
): ChoiceState {
  if (!checked) return index === selected ? 'selected' : 'idle';
  if (index === correct) return 'correct';
  if (index === selected) return 'wrong';
  return 'dimmed';
}

export const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2 },
  flex: { flex: 1 },
  stack: { gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

/**
 * "New word" card: shown in a vocabulary lesson before the first exercise that uses the word, so
 * a beginner meets the word (sound, spelling, meaning) before being asked about it.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LexiconEntry } from '@/core/content/bundle-types';
import { tts } from '@/core/speech/tts';
import { AppText } from '@/ui/components/AppText';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { useTheme } from '@/ui/theme/ThemeProvider';

export function WordIntro({ word, autoplay = true }: { word: LexiconEntry; autoplay?: boolean }) {
  const { colors, radius, space } = useTheme();

  // The word is heard right away, as a teacher would say it.
  useEffect(() => {
    if (autoplay) void tts.speak(word.en);
    return () => void tts.stop();
  }, [word.en, autoplay]);

  const picture = word.picture && 'emoji' in word.picture ? word.picture.emoji : null;
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="caption" color="accent">
        Новое слово
      </AppText>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
            padding: space.lg,
            gap: space.sm,
          },
        ]}
      >
        {picture && (
          <AppText style={styles.emoji} aria-hidden>
            {picture}
          </AppText>
        )}
        <View style={styles.row}>
          <AppText variant="display">{word.en}</AppText>
          <SpeakButtons text={word.en} large label={`Произнести ${word.en}`} />
        </View>
        {word.ipa && (
          <AppText variant="body" color="textMuted">
            /{word.ipa}/
          </AppText>
        )}
        <AppText variant="heading">{word.ru.join(', ')}</AppText>
        {word.note && (
          <AppText variant="small" color="textMuted">
            {word.note}
          </AppText>
        )}
      </View>
      {word.example && (
        <View style={[styles.row, styles.example]}>
          <SpeakButtons text={word.example.en} label="Прослушать пример" />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{word.example.en}</AppText>
            <AppText variant="small" color="textMuted">
              {word.example.ru}
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, alignItems: 'center' },
  emoji: { fontSize: 72, lineHeight: 88, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  example: { alignItems: 'flex-start' },
  flex: { flex: 1 },
});

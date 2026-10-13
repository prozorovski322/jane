import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Exercise } from '@/core/content/schema';
import type { Verdict } from '@/core/scoring/check';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { useTheme } from '@/ui/theme/ThemeProvider';

function title(v: Verdict): string {
  switch (v.quality) {
    case 'perfect':
      return 'Верно!';
    case 'typo':
      return 'Почти! Есть опечатка';
    case 'self':
      return 'Засчитано';
    case 'partial':
      return v.correct ? 'Готово' : 'Частично верно';
    case 'wrong':
      return 'Не совсем';
  }
}

/** Shown after checking: verdict, correct answer, explanation (always), and the next step. */
export function FeedbackPanel({
  exercise,
  verdict,
  willRetry,
  onContinue,
}: {
  exercise: Exercise;
  verdict: Verdict;
  willRetry: boolean;
  onContinue: () => void;
}) {
  const { colors, radius, space } = useTheme();
  const good = verdict.correct;
  const { height } = useWindowDimensions();
  const tone = good
    ? { bg: colors.successSoft, fg: colors.success }
    : { bg: colors.errorSoft, fg: colors.error };
  const showExpected =
    !!verdict.expected &&
    (verdict.quality === 'wrong' ||
      verdict.quality === 'typo' ||
      (verdict.quality === 'partial' && !good)) &&
    exercise.type !== 'comprehension' &&
    exercise.type !== 'match_pairs';
  const isSample =
    exercise.type === 'write' ||
    exercise.type === 'speak_answer' ||
    exercise.type === 'speak_describe';

  return (
    <Appear
      role="alert"
      aria-live="assertive"
      style={[
        styles.panel,
        {
          backgroundColor: tone.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.lg,
        },
      ]}
    >
      <View style={styles.head}>
        <Icon name={good ? 'check' : 'cross'} size={28} color={tone.fg} />
        <AppText variant="title" style={{ color: tone.fg }}>
          {title(verdict)}
        </AppText>
      </View>

      {/* Long feedback (writing) scrolls; the button below always stays reachable. */}
      <ScrollView style={{ maxHeight: height * 0.45 }} contentContainerStyle={styles.body}>
        {verdict.typos?.length ? (
          <AppText variant="body">
            {verdict.typos.map((t) => `${t.typed} → ${t.expected}`).join(', ')}
          </AppText>
        ) : null}

        {showExpected && (
          <View>
            <AppText variant="smallStrong" color="textMuted">
              {isSample ? 'Пример ответа:' : 'Правильный ответ:'}
            </AppText>
            <AppText variant="bodyStrong">{verdict.expected}</AppText>
          </View>
        )}

        {verdict.writing && (
          <View style={styles.list}>
            {verdict.writing.criteria.map((c) => (
              <View key={c.id} style={styles.row}>
                <Icon
                  name={c.met ? 'check' : 'cross'}
                  size={18}
                  color={c.met ? colors.success : colors.error}
                />
                <AppText variant="small">{c.label}</AppText>
              </View>
            ))}
            {verdict.writing.tooShort && (
              <AppText variant="small">Текст короче, чем нужно.</AppText>
            )}
            {verdict.writing.mistakes.map((m, i) => (
              <AppText key={i} variant="small">
                «{m.fragment}»: {m.message}
              </AppText>
            ))}
            {verdict.correct && (
              <AppText variant="small" color="textMuted">
                Пример: {verdict.expected}
              </AppText>
            )}
          </View>
        )}

        {verdict.speech?.keywords !== undefined && !verdict.correct && (
          <AppText variant="small">
            Не хватает ключевых слов: найдено {verdict.speech.keywords} из {verdict.speech.needed}.
          </AppText>
        )}

        <AppText variant="small">{exercise.explanation}</AppText>

        {willRetry && (
          <AppText variant="caption" color="textMuted">
            Это задание вернётся в конце урока.
          </AppText>
        )}
      </ScrollView>

      <Button
        label="Дальше"
        variant={good ? 'success' : 'danger'}
        icon="arrow-right"
        onPress={onContinue}
      />
    </Appear>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  body: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

/**
 * Temporary home: progress header and the lesson list. Replaced by the Path and Today screens in
 * stage 5.
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse, getGrammarNote } from '@/core/content';
import { useProgress } from '@/features/progress/store';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Choice } from '@/ui/components/Choice';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

const KIND: Record<string, string> = {
  vocabulary: 'слова',
  grammar: 'грамматика',
  listening: 'аудирование',
  reading: 'чтение',
  speaking: 'говорение',
  writing: 'письмо',
  pronunciation: 'произношение',
  review: 'повторение',
};

function ProgressHeader() {
  const { colors, radius, space } = useTheme();
  const snapshot = useProgress((s) => s.snapshot);
  const due = useProgress((s) => s.dueCount);
  if (!snapshot) return null;
  const goal = Math.min(1, snapshot.todayXp / snapshot.goalXp);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          gap: space.sm,
        },
      ]}
    >
      <View style={styles.row}>
        <AppText
          variant="bodyStrong"
          color="accent"
          accessibilityLabel={`Серия: ${snapshot.streak}`}
        >
          Серия {snapshot.streak}
        </AppText>
        <AppText variant="bodyStrong" color="xp">
          {snapshot.totalXp} XP
        </AppText>
        <AppText variant="small" color="textMuted">
          Заморозки: {snapshot.freezes}
        </AppText>
      </View>
      <View style={styles.row}>
        <AppText variant="smallStrong">Цель дня</AppText>
        <AppText variant="small" color="textMuted">
          {Math.min(snapshot.todayXp, snapshot.goalXp)} / {snapshot.goalXp} XP
        </AppText>
      </View>
      <ProgressBar value={goal} label="Цель дня" />
      <Button
        label={due ? `Повторение: ${due}` : 'Повторять пока нечего'}
        icon="refresh"
        variant={due ? 'primary' : 'secondary'}
        disabled={!due}
        onPress={() => router.push('/review')}
      />
    </View>
  );
}

export default function Home() {
  const { colors, space } = useTheme();
  const course = getCourse();
  const completed = useProgress((s) => s.snapshot?.completedLessons);
  const done = (id: string) => (completed?.has(id) ? '✓ ' : '');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm }}>
        <AppText variant="display">Jane</AppText>
        <ProgressHeader />
        {course.levels.map((level) => (
          <View key={level.level} style={{ gap: space.sm, marginTop: space.md }}>
            <AppText variant="title" role="heading">
              {level.level} · {level.title}
            </AppText>
            {level.units.map((u) => (
              <View key={u.id} style={{ gap: space.xs }}>
                <AppText variant="heading" role="heading">
                  {u.order}. {u.title.ru} · {u.title.en}
                </AppText>
                <AppText variant="small" color="textMuted">
                  {u.grammar.map((g) => getGrammarNote(g)?.title ?? g).join(' · ')}
                </AppText>
                {u.lessons.map((l, i) => (
                  <Choice
                    key={l.id}
                    label={`${done(l.id)}${i + 1}. ${l.title} — ${KIND[l.kind] ?? l.kind}, ${l.exerciseCount} заданий`}
                    onPress={() => router.push(`/lesson/${l.id}`)}
                  />
                ))}
                <Choice
                  label={`${done(`${u.id}.test`)}Тест юнита — ${u.testExerciseCount} заданий`}
                  onPress={() => router.push(`/lesson/${u.id}.test`)}
                />
              </View>
            ))}
          </View>
        ))}
        <AppText variant="caption" color="textMuted">
          Контент {course.version}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { borderWidth: 2, padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
});

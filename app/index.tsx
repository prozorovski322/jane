/**
 * Temporary lesson list: opens any lesson of the course. Replaced by the Path screen in stage 5.
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse, getGrammarNote } from '@/core/content';
import { AppText } from '@/ui/components/AppText';
import { Choice } from '@/ui/components/Choice';
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

export default function LessonList() {
  const { colors, space } = useTheme();
  const course = getCourse();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm }}>
        <AppText variant="display">Jane</AppText>
        <AppText variant="small" color="textMuted">
          Контент {course.version}
        </AppText>
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
                    label={`${i + 1}. ${l.title} — ${KIND[l.kind] ?? l.kind}, ${l.exerciseCount} заданий`}
                    onPress={() => router.push(`/lesson/${l.id}`)}
                  />
                ))}
                <Choice
                  label={`Тест юнита — ${u.testExerciseCount} заданий`}
                  onPress={() => router.push(`/lesson/${u.id}.test`)}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});

/**
 * Temporary content preview: proves the compiled bundle loads in the app.
 * Replaced by the Path screen in stage 5.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse, getGrammarNote, getLexicon, getUnit } from '@/core/content';

export default function ContentPreview() {
  const course = getCourse();
  const lexicon = getLexicon();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Jane</Text>
        <Text style={styles.muted}>
          Контент {course.version} · слов: {lexicon.size}
        </Text>
        {course.levels.map((level) => (
          <View key={level.level} style={styles.section}>
            <Text style={styles.h2}>
              {level.level} — {level.title}
            </Text>
            {level.units.map((u) => {
              const unit = getUnit(u.id);
              const exercises = unit.lessons.reduce((n, l) => n + l.exercises.length, 0);
              return (
                <View key={u.id} style={styles.card} accessibilityRole="summary">
                  <Text style={styles.h3}>
                    {u.order}. {u.title.ru} · {u.title.en}
                  </Text>
                  <Text style={styles.muted}>
                    {u.lessons.length} уроков · {exercises} заданий · тест {u.testExerciseCount} ·
                    слов {u.wordCount}
                  </Text>
                  {u.lessons.map((l) => (
                    <Text key={l.id} style={styles.row}>
                      {l.title} — {l.kind}, {l.exerciseCount}
                    </Text>
                  ))}
                  <Text style={styles.muted}>
                    Грамматика: {u.grammar.map((g) => getGrammarNote(g)?.title ?? g).join('; ')}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '600' },
  h3: { fontSize: 17, fontWeight: '600' },
  row: { fontSize: 15 },
  muted: { fontSize: 14, color: '#555' },
  section: { gap: 8, marginTop: 16 },
  card: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: '#f2f2f5' },
});

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse, getLexicon, getPlacementBank } from '@/core/content';
import type { Level } from '@/core/content/schema';
import { checkExercise, expectedAnswer, type Response } from '@/core/scoring/check';
import { getDb } from '@/core/storage';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { IconButton } from '@/ui/components/IconButton';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { ExerciseView } from '../lesson/exercises/ExerciseView';
import type { ExerciseContext } from '../lesson/exercises/types';
import { useProgress } from '../progress/store';
import { applyPlacement } from './apply';
import {
  answer,
  MAX_ITEMS,
  MIN_ITEMS,
  nextItem,
  placementResult,
  startPlacement,
  type PlacementResult,
  type SelfLevel,
} from './engine';

export const LEVEL_DESCRIPTION: Record<Level, string> = {
  A1: 'Начальный: понимаете и используете простые фразы о себе и повседневных делах.',
  A2: 'Элементарный: справляетесь в простых бытовых ситуациях, рассказываете о себе и о прошлом.',
  B1: 'Средний: объясняетесь в большинстве ситуаций, рассказываете об опыте и планах, высказываете мнение.',
  B2: 'Выше среднего: свободно говорите на многие темы, понимаете сложные тексты, аргументируете.',
};

const ctx: ExerciseContext = {
  word: (id) => getLexicon().get(id),
  text: () => undefined,
  cantListen: false,
};

function Result({
  result,
  credited,
  onDone,
}: {
  result: PlacementResult;
  credited: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const [showReview, setShowReview] = useState(false);
  const bank = getPlacementBank().items;
  const missed = result.missed.map((id) => bank.find((i) => i.exercise.id === id)!).filter(Boolean);
  const courseLevels = getCourse().levels.map((l) => l.level);
  const beyondCourse = !courseLevels.includes(result.level);
  // «С нуля» only for those who really answered almost nothing; others just start at A1.
  const zero = result.fromZero && result.correct <= 3;

  return (
    <ScrollView contentContainerStyle={styles.result}>
      <AppText variant="caption" color="textMuted" align="center">
        Результат теста
      </AppText>
      <AppText variant="display" align="center" role="heading" style={{ color: colors.primary }}>
        {zero ? 'Начнём с нуля' : `Уровень ${result.level}`}
      </AppText>
      <AppText variant="body" align="center">
        {zero
          ? 'Отличная точка старта: курс начинается с самых основ.'
          : LEVEL_DESCRIPTION[result.level]}
      </AppText>
      <Card>
        <AppText variant="body">
          Верных ответов: {result.correct} из {result.answered}.
        </AppText>
        <AppText variant="body">
          {credited
            ? `Засчитано уроков: ${credited}. Они отмечены на пути — к любому можно вернуться.`
            : 'Начнём с первого урока — пройденное отметится по ходу.'}
        </AppText>
        {beyondCourse && (
          <AppText variant="small" color="textMuted">
            Уроки уровня {result.level} появятся с обновлением курса. Пока — повторение и практика
            на пройденном.
          </AppText>
        )}
        <AppText variant="caption" color="textMuted">
          Это оценка по короткому тесту, а не экзаменационный результат. Тест можно пройти ещё раз в
          профиле.
        </AppText>
      </Card>

      {missed.length > 0 && (
        <Button
          label={showReview ? 'Скрыть разбор' : `Разбор ошибок (${missed.length})`}
          variant="secondary"
          onPress={() => setShowReview((v) => !v)}
        />
      )}
      {showReview &&
        missed.map((item) => (
          <Card key={item.exercise.id}>
            <AppText variant="caption" color="textMuted">
              {item.level}
            </AppText>
            <AppText variant="bodyStrong">{expectedAnswer(item.exercise)}</AppText>
            <AppText variant="small">{item.exercise.explanation}</AppText>
          </Card>
        ))}
      <Button label="Продолжить" icon="arrow-right" onPress={onDone} />
    </ScrollView>
  );
}

/**
 * The adaptive test. No right/wrong feedback during the test — that keeps it short and avoids
 * discouraging beginners; mistakes are reviewed at the end.
 */
export function PlacementRunner({
  self,
  onDone,
  onCancel,
}: {
  self: SelfLevel;
  onDone: (r: PlacementResult) => void;
  onCancel: () => void;
}) {
  const { colors, space } = useTheme();
  const bank = getPlacementBank().items;
  // A new item order for every attempt; fixed for the life of this test.
  const [seed] = useState(() => String(Date.now()));
  const [state, setState] = useState(() => startPlacement(self));
  const [pending, setPending] = useState<Response | null>(null);
  const [finished, setFinished] = useState<{ result: PlacementResult; credited: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const item = useMemo(
    () => (finished ? null : nextItem(state, bank, seed)),
    [state, bank, seed, finished],
  );

  const finish = async (s: typeof state) => {
    const result = placementResult(s);
    setSaving(true);
    const db = getDb();
    const credited = await applyPlacement(db, getCourse(), result);
    await useProgress.getState().refresh(db);
    setSaving(false);
    setFinished({ result, credited });
  };

  const submit = (r: Response | 'unknown') => {
    if (!item) return;
    const next = answer(
      state,
      item,
      r === 'unknown' ? 'unknown' : { correct: checkExercise(item.exercise, r).correct },
    );
    setPending(null);
    setState(next);
    if (!nextItem(next, bank, seed)) void finish(next);
  };

  if (finished) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <Result
          result={finished.result}
          credited={finished.credited}
          onDone={() => onDone(finished.result)}
        />
      </SafeAreaView>
    );
  }

  const n = state.answers.length;
  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.header, { paddingHorizontal: space.md }]}>
        <IconButton icon="close" label="Прервать тест" onPress={onCancel} />
        <ProgressBar
          value={Math.min(1, n / ((MIN_ITEMS + MAX_ITEMS) / 2))}
          label="Прогресс теста"
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="caption" color="textMuted">
          Вопрос {n + 1} · отвечайте без подсказок, «Не знаю» — честный ответ
        </AppText>
        {item && (
          <ExerciseView
            key={item.exercise.id}
            exercise={item.exercise}
            onChange={setPending}
            verdict={null}
            seed={item.exercise.id}
            ctx={ctx}
          />
        )}
      </ScrollView>
      <View style={[styles.footer, { padding: space.md, borderTopColor: colors.border }]}>
        <Button
          label="Не знаю"
          variant="ghost"
          compact
          disabled={saving}
          onPress={() => submit('unknown')}
        />
        <Button
          label="Ответить"
          disabled={!pending || saving}
          loading={saving}
          onPress={() => pending && submit(pending)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  footer: { gap: 8, borderTopWidth: 1 },
  result: { padding: 24, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
});

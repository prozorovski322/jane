import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLesson, getLexicon, getUnit, isCourseWord } from '@/core/content';
import { feedback } from '@/core/feedback/feedback';
import type { Response } from '@/core/scoring/check';
import { tts } from '@/core/speech/tts';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { IconButton } from '@/ui/components/IconButton';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { FeedbackPanel } from './components/FeedbackPanel';
import { LessonSummary } from './components/LessonSummary';
import {
  canSkip,
  createLesson,
  currentItem,
  makeReducer,
  progress,
  summarize,
  type LessonSummary as Summary,
} from './engine';
import { ExerciseView } from './exercises/ExerciseView';
import type { ExerciseContext } from './exercises/types';

const reducer = makeReducer({ isWord: isCourseWord, wordLabel: (id) => getLexicon().get(id)?.en });

export function LessonScreen({
  lessonId,
  startAt = 0,
  onExit,
}: {
  lessonId: string;
  /** Skip the first exercises (development aid). */
  startAt?: number;
  onExit: (summary: Summary | null) => void;
}) {
  const lesson = useMemo(() => getLesson(lessonId), [lessonId]);
  if (!lesson) {
    return (
      <SafeAreaView style={styles.center}>
        <AppText variant="heading">Урок не найден</AppText>
        <Button label="Назад" onPress={() => onExit(null)} />
      </SafeAreaView>
    );
  }
  return <LessonRunner lesson={lesson} startAt={startAt} onExit={onExit} />;
}

function LessonRunner({
  lesson,
  startAt,
  onExit,
}: {
  lesson: NonNullable<ReturnType<typeof getLesson>>;
  startAt: number;
  onExit: (summary: Summary | null) => void;
}) {
  const { colors, space } = useTheme();
  const [state, dispatch] = useReducer(reducer, null, () =>
    createLesson(lesson.id, lesson.exercises.slice(startAt)),
  );
  const [confirmExit, setConfirmExit] = useState(false);
  const [cantListen, setCantListen] = useState(false);
  const [cantSpeak, setCantSpeak] = useState(false);

  const item = currentItem(state);
  const exercise = item?.exercise;
  const key = `${state.position}:${exercise?.id ?? 'done'}`;

  // Answer and hint belong to one exercise: tagging them with its key resets them on the next one.
  const [pendingFor, setPendingFor] = useState<{ key: string; response: Response | null }>({
    key,
    response: null,
  });
  const pending = pendingFor.key === key ? pendingFor.response : null;
  const [hintKey, setHintKey] = useState<string | null>(null);
  const hintOpen = hintKey === key;

  const ctx: ExerciseContext = useMemo(() => {
    const lexicon = getLexicon();
    const unit = getUnit(lesson.unit.id);
    return {
      word: (id) => lexicon.get(id),
      text: (id) => unit.texts.find((t) => t.id === id),
      cantListen,
    };
  }, [lesson.unit.id, cantListen]);

  // Leaving an exercise stops its audio.
  useEffect(() => () => void tts.stop(), [key]);

  // Exercises the learner said they cannot do right now are skipped without penalty.
  useEffect(() => {
    if (!exercise || state.phase !== 'answering') return;
    const listeningOnly = exercise.type !== 'comprehension';
    if (
      (cantListen && listeningOnly && canSkip(exercise, 'cant-listen')) ||
      (cantSpeak && canSkip(exercise, 'cant-speak'))
    ) {
      dispatch({
        type: 'skip',
        reason: canSkip(exercise, 'cant-speak') ? 'cant-speak' : 'cant-listen',
      });
    }
  }, [exercise, state.phase, cantListen, cantSpeak]);

  useEffect(() => {
    if (!state.verdict) return;
    if (state.verdict.correct) feedback.correct();
    else feedback.wrong();
  }, [state.verdict]);

  const onChange = useCallback(
    (response: Response | null) => setPendingFor({ key, response }),
    [key],
  );

  if (state.phase === 'done') {
    const summary = summarize(state);
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <LessonSummary
          summary={summary}
          isTest={lesson.isTest}
          passScore={lesson.unit.test.passScore}
          onDone={() => onExit(summary)}
        />
      </SafeAreaView>
    );
  }

  const willRetry = !!state.verdict && state.verdict.quality === 'wrong' && !item?.retry;
  const listenSkippable =
    exercise && canSkip(exercise, 'cant-listen') && exercise.type !== 'comprehension';
  const speakSkippable = exercise && canSkip(exercise, 'cant-speak');

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingHorizontal: space.md }]}>
          <IconButton icon="close" label="Закрыть урок" onPress={() => setConfirmExit(true)} />
          <ProgressBar value={progress(state)} label="Прогресс урока" />
          <IconButton
            icon="bulb"
            label={hintOpen ? 'Скрыть подсказку' : 'Подсказка'}
            color={hintOpen ? 'xp' : 'textMuted'}
            disabled={state.phase !== 'answering'}
            onPress={() => {
              if (!hintOpen) dispatch({ type: 'hint' });
              setHintKey(hintOpen ? null : key);
            }}
          />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {item?.retry && (
            <AppText variant="caption" color="accent">
              Ещё раз: задание, где была ошибка
            </AppText>
          )}
          {hintOpen && exercise && (
            <Appear
              variant="fade"
              duration={150}
              style={[styles.hint, { backgroundColor: colors.xpSoft, borderRadius: 16 }]}
              aria-live="polite"
            >
              <AppText variant="small">{exercise.hint}</AppText>
            </Appear>
          )}
          {exercise && (
            <ExerciseView
              key={key}
              exercise={exercise}
              onChange={onChange}
              verdict={state.verdict}
              seed={key}
              ctx={ctx}
            />
          )}
        </ScrollView>

        {confirmExit ? (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.surface, borderTopColor: colors.border, padding: space.md },
            ]}
          >
            <AppText variant="heading">Закончить урок?</AppText>
            <AppText variant="small" color="textMuted">
              Результат этого урока не сохранится. Можно вернуться к нему в любой момент.
            </AppText>
            <Button label="Продолжить урок" onPress={() => setConfirmExit(false)} />
            <Button label="Выйти" variant="ghost" onPress={() => onExit(null)} />
          </View>
        ) : state.phase === 'feedback' && state.verdict && exercise ? (
          <FeedbackPanel
            exercise={exercise}
            verdict={state.verdict}
            willRetry={willRetry}
            onContinue={() => dispatch({ type: 'continue' })}
          />
        ) : (
          <View style={[styles.footer, { borderTopColor: colors.border, padding: space.md }]}>
            {listenSkippable && (
              <Button
                label="Не могу слушать сейчас"
                variant="ghost"
                compact
                accessibilityHint="Задания на слух в этом уроке будут пропущены без штрафа"
                onPress={() => setCantListen(true)}
              />
            )}
            {speakSkippable && (
              <Button
                label="Не могу говорить сейчас"
                variant="ghost"
                compact
                accessibilityHint="Задания на речь в этом уроке будут пропущены без штрафа"
                onPress={() => setCantSpeak(true)}
              />
            )}
            <Button
              label="Проверить"
              disabled={!pending}
              testID="check"
              onPress={() => pending && dispatch({ type: 'answer', response: pending })}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  hint: { padding: 12 },
  footer: { gap: 8, borderTopWidth: 1 },
});

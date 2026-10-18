import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLexicon, isCourseWord } from '@/core/content';
import type { Exercise, Level } from '@/core/content/schema';
import { feedback } from '@/core/feedback/feedback';
import type { Response } from '@/core/scoring/check';
import { tts } from '@/core/speech/tts';
import { Appear } from '@/ui/components/Appear';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { IconButton } from '@/ui/components/IconButton';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import type { CompletionInfo } from '../progress/service';
import { FeedbackPanel } from './components/FeedbackPanel';
import { WordIntro } from './components/WordIntro';
import { LessonSummary, type SaveState } from './components/LessonSummary';
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
import type { LessonSession } from './session';

/** DOM id of the exercise area on the web (keyboard handling). */
const EXERCISE_AREA = 'lesson-exercise';

const reducer = makeReducer({ isWord: isCourseWord, wordLabel: (id) => getLexicon().get(id)?.en });

export interface LessonScreenProps {
  session: LessonSession | null;
  /** Saves the result; resolves with what the learner earned. */
  onComplete?: (summary: Summary) => Promise<CompletionInfo>;
  /** Leaves the screen (after the summary, or when the learner quits). */
  onExit: () => void;
  /** Opens the certificate screen after a passed level exam. */
  onOpenCertificate?: (level: Level) => void;
  /** Leaves out exercises the learner has mastered (repeated lessons). */
  skip?: (ex: Exercise) => boolean;
  /** Skip the first exercises (development aid). */
  startAt?: number;
}

export function LessonScreen({ session, ...rest }: LessonScreenProps) {
  if (!session || !session.exercises.length) {
    return (
      <SafeAreaView style={styles.center}>
        <AppText variant="heading">
          {session ? 'Здесь пока нечего повторять' : 'Урок не найден'}
        </AppText>
        <Button label="Назад" onPress={rest.onExit} />
      </SafeAreaView>
    );
  }
  return <LessonRunner session={session} {...rest} />;
}

function LessonRunner({
  session,
  onComplete,
  onExit,
  onOpenCertificate,
  skip,
  startAt = 0,
}: LessonScreenProps & { session: LessonSession }) {
  const { colors, space } = useTheme();
  const [state, dispatch] = useReducer(reducer, null, () =>
    createLesson(session.id, session.exercises.slice(startAt), { skip }),
  );
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
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
    return {
      word: (id) => lexicon.get(id),
      text: (id) => session.texts.find((t) => t.id === id),
      cantListen,
    };
  }, [session.texts, cantListen]);

  const summary = useMemo(() => (state.phase === 'done' ? summarize(state) : null), [state]);

  // New words: before the first exercise that uses a word, a card introduces it.
  const [introduced, setIntroduced] = useState<ReadonlySet<string>>(() => new Set());
  const introWord = useMemo(() => {
    if (!exercise || state.phase !== 'answering' || item?.retry || !session.introWords) return null;
    const id = exercise.words.find((w) => session.introWords!.includes(w) && !introduced.has(w));
    return id ? (getLexicon().get(id) ?? null) : null;
  }, [exercise, state.phase, item?.retry, session.introWords, introduced]);
  const nextIntro = useCallback(
    () => introWord && setIntroduced((s) => new Set(s).add(introWord.id)),
    [introWord],
  );
  const skipIntros = () => setIntroduced(new Set(session.introWords));

  // State changes only after the await: "idle" with a summary already reads as "saving".
  const persist = useCallback(
    async (s: Summary) => {
      if (!onComplete) return;
      try {
        const info = await onComplete(s);
        setSave({ status: 'saved', info });
      } catch (e) {
        setSave({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    },
    [onComplete],
  );

  // Save once, as soon as the session is over.
  const saveStarted = useRef(false);
  useEffect(() => {
    if (!summary || saveStarted.current) return;
    saveStarted.current = true;
    void persist(summary);
  }, [summary, persist]);

  // On a computer, Enter checks the answer and moves on. After a click on an option the focus stays
  // on it: Enter there is taken before the option sees it (capture phase), so it checks instead of
  // pressing the option again. The essay field keeps Enter for new lines; the buttons below the
  // exercise (Check, Continue, Close) handle Enter themselves.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || confirmExit) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.tagName === 'TEXTAREA') return;
      const inExercise = !!target?.closest(`#${EXERCISE_AREA}`);
      if (!inExercise && target?.closest('button, [role="button"], a')) return;
      if (introWord) {
        e.preventDefault();
        nextIntro();
        return;
      }
      const action =
        state.phase === 'feedback'
          ? ({ type: 'continue' } as const)
          : state.phase === 'answering' && pending
            ? ({ type: 'answer', response: pending } as const)
            : null;
      // Nothing to check yet: Enter on an option still picks it.
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      dispatch(action);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state.phase, pending, confirmExit, introWord, nextIntro]);

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

  if (summary) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <LessonSummary
          summary={summary}
          kind={session.kind}
          passScore={session.passScore}
          save={onComplete ? (save.status === 'idle' ? { status: 'saving' } : save) : null}
          onRetrySave={() => {
            setSave({ status: 'saving' });
            void persist(summary);
          }}
          onDone={onExit}
          onOpenCertificate={onOpenCertificate}
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
        style={[styles.flex, styles.column]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingHorizontal: space.md }]}>
          <IconButton icon="close" label="Закрыть урок" onPress={() => setConfirmExit(true)} />
          <ProgressBar value={progress(state)} label="Прогресс урока" />
          <IconButton
            icon="bulb"
            label={hintOpen ? 'Скрыть подсказку' : 'Подсказка'}
            color={hintOpen ? 'xp' : 'textMuted'}
            disabled={state.phase !== 'answering' || !!introWord}
            onPress={() => {
              if (!hintOpen) dispatch({ type: 'hint' });
              setHintKey(hintOpen ? null : key);
            }}
          />
        </View>

        <ScrollView
          nativeID={EXERCISE_AREA}
          style={styles.flex}
          contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {item?.retry && (
            <AppText variant="caption" color="accent">
              Ещё раз: задание, где была ошибка
            </AppText>
          )}
          {introWord && <WordIntro key={introWord.id} word={introWord} />}
          {hintOpen && exercise && !introWord && (
            <Appear
              variant="fade"
              duration={150}
              style={[styles.hint, { backgroundColor: colors.xpSoft, borderRadius: 16 }]}
              aria-live="polite"
            >
              <AppText variant="small">{exercise.hint}</AppText>
            </Appear>
          )}
          {exercise && !introWord && (
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
            <Button label="Выйти" variant="ghost" onPress={onExit} />
          </View>
        ) : introWord ? (
          <View style={[styles.footer, { borderTopColor: colors.border, padding: space.md }]}>
            <Button label="Понятно, дальше" icon="arrow-right" onPress={nextIntro} />
            <Button
              label="Пропустить новые слова"
              variant="ghost"
              compact
              accessibilityHint="Карточки новых слов в этом уроке больше не появятся"
              onPress={skipIntros}
            />
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
  // The same column as other screens: on a wide screen the lesson stays phone-width in the middle.
  column: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  hint: { padding: 12 },
  footer: { gap: 8, borderTopWidth: 1 },
});

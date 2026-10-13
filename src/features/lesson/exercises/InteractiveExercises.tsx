/**
 * Exercises with several steps inside: matching pairs, finding and fixing a mistake,
 * questions to a text or dialogue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ExerciseOf } from '@/core/content/schema';
import { feedback } from '@/core/feedback/feedback';
import type { TfnAnswer } from '@/core/scoring/check';
import { splitTiles } from '@/core/scoring/tiles';
import { normalizeAnswer } from '@/core/scoring/normalize';
import { tts } from '@/core/speech/tts';
import { shuffle } from '@/lib/random';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Choice, type ChoiceState } from '@/ui/components/Choice';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { Instruction, optionState, styles as common, useOrder } from './common';
import type { ExerciseViewProps } from './types';

// ---------------------------------------------------------------------------
// Match pairs
// ---------------------------------------------------------------------------

export function MatchPairsView({ exercise: ex, onChange, seed }: ExerciseViewProps<'match_pairs'>) {
  const left = useOrder(ex.pairs.length, `${seed}:en`);
  const right = useOrder(ex.pairs.length, `${seed}:ru`);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [en, setEn] = useState<number | null>(null);
  const [ru, setRu] = useState<number | null>(null);
  const [wrong, setWrong] = useState<[number, number] | null>(null);
  const mistakes = useRef(0);

  /** Called when one side is tapped; checks the pair once both sides are chosen. */
  const pick = (side: 'en' | 'ru', i: number) => {
    const a = side === 'en' ? i : en;
    const b = side === 'ru' ? i : ru;
    if (a === null || b === null) {
      if (side === 'en') setEn(i);
      else setRu(i);
      return;
    }
    setEn(null);
    setRu(null);
    if (a === b) {
      feedback.tap();
      const next = new Set(matched).add(a);
      setMatched(next);
      if (next.size === ex.pairs.length) {
        feedback.correct();
        onChange({ kind: 'pairs', mistakes: mistakes.current });
      }
    } else {
      feedback.wrong();
      mistakes.current++;
      setWrong([a, b]);
      setTimeout(() => setWrong(null), 600);
    }
  };

  const state = (i: number, side: 'en' | 'ru'): ChoiceState => {
    if (matched.has(i)) return 'correct';
    if (wrong && wrong[side === 'en' ? 0 : 1] === i) return 'wrong';
    return (side === 'en' ? en : ru) === i ? 'selected' : 'idle';
  };

  return (
    <View style={common.stack}>
      <Instruction>Найдите пары</Instruction>
      <View style={local.columns}>
        <View style={local.column}>
          {left.map((i) => (
            <Choice
              key={i}
              label={ex.pairs[i]!.en}
              compact
              state={state(i, 'en')}
              disabled={matched.has(i)}
              onPress={() => {
                void tts.speak(ex.pairs[i]!.en);
                pick('en', i);
              }}
            />
          ))}
        </View>
        <View style={local.column}>
          {right.map((i) => (
            <Choice
              key={i}
              compact
              label={ex.pairs[i]!.ru}
              state={state(i, 'ru')}
              disabled={matched.has(i)}
              onPress={() => pick('ru', i)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error correction
// ---------------------------------------------------------------------------

export function ErrorCorrectionView({
  exercise: ex,
  onChange,
  verdict,
  seed,
}: ExerciseViewProps<'error_correction'>) {
  const { colors, radius } = useTheme();
  const tokens = useMemo(() => ex.text.split(/\s+/), [ex.text]);
  const wrongTokens = useMemo(() => new Set(splitTiles(ex.wrong).map(normalizeAnswer)), [ex.wrong]);
  const options = useMemo(() => shuffle(ex.options, seed), [ex.options, seed]);
  const [tapped, setTapped] = useState<number | null>(null);
  const [fix, setFix] = useState<string | null>(null);

  const report = (t: number | null, f: string | null) => {
    onChange(
      t !== null && f
        ? { kind: 'correction', fragment: splitTiles(tokens[t]!)[0] ?? tokens[t]!, correction: f }
        : null,
    );
  };

  return (
    <View style={common.stack}>
      <Instruction>Найдите ошибку и исправьте её</Instruction>
      <AppText variant="small" color="textMuted">
        1. Нажмите на неправильное слово.
      </AppText>
      <View
        style={[
          local.sentence,
          { borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
        ]}
      >
        {tokens.map((tok, i) => {
          const isWrong = wrongTokens.has(normalizeAnswer(splitTiles(tok)[0] ?? tok));
          const state: ChoiceState = verdict
            ? isWrong
              ? 'correct'
              : i === tapped
                ? 'wrong'
                : 'idle'
            : i === tapped
              ? 'selected'
              : 'idle';
          return (
            <Choice
              key={i}
              label={tok}
              state={state}
              disabled={!!verdict}
              compact
              style={local.word}
              onPress={() => {
                setTapped(i);
                report(i, fix);
              }}
            />
          );
        })}
      </View>
      {tapped !== null && (
        <>
          <AppText variant="small" color="textMuted">
            2. Выберите, как правильно.
          </AppText>
          <View style={common.wrapRow} role="radiogroup">
            {options.map((o) => (
              <Choice
                key={o}
                label={o}
                state={
                  verdict
                    ? o === ex.correction
                      ? 'correct'
                      : o === fix
                        ? 'wrong'
                        : 'dimmed'
                    : o === fix
                      ? 'selected'
                      : 'idle'
                }
                disabled={!!verdict}
                style={local.option}
                onPress={() => {
                  setFix(o);
                  report(tapped, o);
                }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Comprehension
// ---------------------------------------------------------------------------

const TFN: { value: TfnAnswer; label: string }[] = [
  { value: 'true', label: 'Верно' },
  { value: 'false', label: 'Неверно' },
  { value: 'not_given', label: 'Нет информации' },
];

async function playDialogue(
  text: NonNullable<ReturnType<ExerciseViewProps['ctx']['text']>>,
  cancelled: () => boolean,
) {
  const voices = new Map(text.speakers.map((s) => [s.id, s.voice]));
  for (const line of text.lines) {
    if (cancelled()) return;
    await tts.speak(line.en, { voice: line.speaker ? voices.get(line.speaker) : undefined });
  }
}

export function ComprehensionView({
  exercise: ex,
  onChange,
  verdict,
  seed,
  ctx,
}: ExerciseViewProps<'comprehension'>) {
  const { colors, radius } = useTheme();
  const text = ctx.text(ex.textId);
  const listening = ex.mode === 'listening';
  const [showText, setShowText] = useState(!listening || ctx.cantListen);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<(number | TfnAnswer | null)[]>(() =>
    ex.questions.map(() => null),
  );
  const cancel = useRef(false);

  useEffect(
    () => () => {
      cancel.current = true;
      void tts.stop();
    },
    [],
  );

  const play = async () => {
    if (!text) return;
    cancel.current = false;
    setPlaying(true);
    await playDialogue(text, () => cancel.current);
    setPlaying(false);
  };

  const answer = (qi: number, value: number | TfnAnswer) => {
    const next = answers.map((a, i) => (i === qi ? value : a));
    setAnswers(next);
    onChange(next.every((a) => a !== null) ? { kind: 'answers', answers: next } : null);
  };

  const names = new Map(text?.speakers.map((s) => [s.id, s.name]));
  return (
    <View style={common.stack}>
      <Instruction>
        {listening
          ? 'Послушайте диалог и ответьте на вопросы'
          : 'Прочитайте текст и ответьте на вопросы'}
      </Instruction>
      {text && <AppText variant="title">{text.title.en}</AppText>}
      {listening && (
        <View style={local.row}>
          <Button
            label={playing ? 'Остановить' : 'Слушать диалог'}
            icon="speaker"
            compact
            onPress={() => {
              if (playing) {
                cancel.current = true;
                void tts.stop();
                setPlaying(false);
              } else void play();
            }}
          />
          <Button
            label={showText ? 'Скрыть текст' : 'Показать текст'}
            icon="eye"
            variant="secondary"
            compact
            onPress={() => setShowText((v) => !v)}
          />
        </View>
      )}
      {showText && text && (
        <View
          style={[
            local.text,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          {text.lines.map((l, i) => (
            <AppText key={i} variant="body">
              {l.speaker ? <AppText variant="bodyStrong">{names.get(l.speaker)}: </AppText> : null}
              {l.en}
            </AppText>
          ))}
          {text.glossary.length > 0 && (
            <AppText variant="small" color="textMuted">
              {text.glossary.map((g) => `${g.en} — ${g.ru}`).join('; ')}
            </AppText>
          )}
        </View>
      )}
      {ex.questions.map((q, qi) => (
        <QuestionBlock
          key={qi}
          number={qi + 1}
          question={q}
          seed={`${seed}:${qi}`}
          value={answers[qi] ?? null}
          checked={!!verdict}
          onAnswer={(v) => answer(qi, v)}
        />
      ))}
    </View>
  );
}

function QuestionBlock({
  number,
  question: q,
  seed,
  value,
  checked,
  onAnswer,
}: {
  number: number;
  question: ExerciseOf<'comprehension'>['questions'][number];
  seed: string;
  value: number | TfnAnswer | null;
  checked: boolean;
  onAnswer: (v: number | TfnAnswer) => void;
}) {
  const order = useOrder(q.kind === 'mcq' ? q.options.length : 0, seed);
  return (
    <View style={local.question}>
      <AppText variant="bodyStrong">
        {number}. {q.kind === 'mcq' ? q.question : q.statement}
      </AppText>
      <View style={q.kind === 'mcq' ? common.stack : common.wrapRow} role="radiogroup">
        {q.kind === 'mcq'
          ? order.map((i) => (
              <Choice
                key={i}
                label={q.options[i]}
                state={optionState(i, value as number | null, q.answer, checked)}
                disabled={checked}
                onPress={() => onAnswer(i)}
              />
            ))
          : TFN.map((o) => (
              <Choice
                key={o.value}
                label={o.label}
                state={
                  checked
                    ? o.value === q.answer
                      ? 'correct'
                      : o.value === value
                        ? 'wrong'
                        : 'dimmed'
                    : o.value === value
                      ? 'selected'
                      : 'idle'
                }
                disabled={checked}
                style={local.tfn}
                onPress={() => onAnswer(o.value)}
              />
            ))}
      </View>
      {checked && (
        <AppText variant="small" color="textMuted">
          {q.explanation}
        </AppText>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 10 },
  sentence: { borderWidth: 2, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  word: { paddingHorizontal: 10, borderBottomWidth: 3 },
  option: { flexGrow: 1, minWidth: 96 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  text: { borderWidth: 2, padding: 16, gap: 10 },
  question: { gap: 10, paddingTop: 8 },
  tfn: { flexGrow: 1, minWidth: 100 },
});

/**
 * Exercises where the learner builds or types an answer: tiles, typed translation, dictation,
 * fill in the gap.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { splitTiles } from '@/core/scoring/tiles';
import { shuffle } from '@/lib/random';
import { AppText } from '@/ui/components/AppText';
import { Choice } from '@/ui/components/Choice';
import { PressableScale } from '@/ui/components/PressableScale';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { TextField } from '@/ui/components/TextField';
import { feedback } from '@/core/feedback/feedback';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { Instruction, Prompt, styles as common } from './common';
import type { ExerciseViewProps } from './types';

function Tile({
  label,
  onPress,
  disabled,
  ghost,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  ghost?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <PressableScale
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      // A used tile leaves a placeholder in the bank; screen readers should not see it.
      aria-hidden={ghost}
      disabled={disabled}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[
        local.tile,
        {
          borderRadius: radius.md,
          backgroundColor: ghost ? colors.surfaceAlt : colors.surface,
          borderColor: ghost ? colors.surfaceAlt : colors.borderStrong,
        },
      ]}
    >
      <AppText variant="bodyStrong" style={{ color: ghost ? colors.surfaceAlt : colors.text }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function TilesView({ exercise: ex, onChange, verdict, seed }: ExerciseViewProps<'tiles'>) {
  const { colors, radius } = useTheme();
  const bank = useMemo(
    () =>
      shuffle(
        [...splitTiles(ex.answer), ...ex.distractors].map((label, id) => ({ id, label })),
        seed,
      ),
    [ex.answer, ex.distractors, seed],
  );
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onChange(
      next.length
        ? { kind: 'tiles', tiles: next.map((id) => bank.find((t) => t.id === id)!.label) }
        : null,
    );
  };

  const border = verdict ? (verdict.correct ? colors.success : colors.error) : colors.border;
  return (
    <View style={common.stack}>
      <Instruction>
        {ex.from === 'en' ? 'Соберите перевод на русский' : 'Соберите перевод на английский'}
      </Instruction>
      <Prompt text={ex.text} lang={ex.from} />
      <View
        aria-label="Ваш ответ"
        style={[local.answer, { borderColor: border, borderRadius: radius.lg }]}
      >
        {picked.length === 0 && (
          <AppText variant="small" color="textMuted">
            Нажимайте на слова ниже
          </AppText>
        )}
        {picked.map((id) => (
          <Tile
            key={id}
            label={bank.find((t) => t.id === id)!.label}
            disabled={!!verdict}
            onPress={() => update(picked.filter((p) => p !== id))}
          />
        ))}
      </View>
      <View style={common.wrapRow} aria-label="Слова">
        {bank.map((t) =>
          picked.includes(t.id) ? (
            <Tile key={t.id} label={t.label} ghost disabled onPress={() => {}} />
          ) : (
            <Tile
              key={t.id}
              label={t.label}
              disabled={!!verdict}
              onPress={() => update([...picked, t.id])}
            />
          ),
        )}
      </View>
    </View>
  );
}

function TypedAnswer({
  label,
  lang,
  onChange,
  verdict,
  multiline,
}: {
  label: string;
  lang: 'en' | 'ru';
  onChange: ExerciseViewProps['onChange'];
  verdict: ExerciseViewProps['verdict'];
  multiline?: boolean;
}) {
  const [text, setText] = useState('');
  return (
    <TextField
      label={label}
      placeholder={lang === 'en' ? 'Напишите по-английски' : 'Напишите по-русски'}
      value={text}
      editable={!verdict}
      multiline={multiline}
      state={verdict ? (verdict.correct ? 'correct' : 'wrong') : 'idle'}
      onChangeText={(t) => {
        setText(t);
        onChange(t.trim() ? { kind: 'text', text: t } : null);
      }}
    />
  );
}

export function TypeTranslationView({
  exercise: ex,
  onChange,
  verdict,
}: ExerciseViewProps<'type_translation'>) {
  const target = ex.from === 'en' ? 'ru' : 'en';
  return (
    <View style={common.stack}>
      <Instruction>
        {target === 'en' ? 'Переведите на английский' : 'Переведите на русский'}
      </Instruction>
      <Prompt text={ex.text} lang={ex.from} />
      <TypedAnswer label="Перевод" lang={target} onChange={onChange} verdict={verdict} />
    </View>
  );
}

export function ListenDictationView({
  exercise: ex,
  onChange,
  verdict,
  ctx,
}: ExerciseViewProps<'listen_dictation'>) {
  return (
    <View style={common.stack}>
      <Instruction>Напишите, что услышали</Instruction>
      <View style={local.center}>
        <SpeakButtons text={ex.text} large label="Прослушать" />
      </View>
      {ctx.cantListen && (
        <AppText variant="small" color="textMuted" align="center">
          Можно пропустить это задание кнопкой «Не могу слушать».
        </AppText>
      )}
      <TypedAnswer label="Что вы услышали" lang="en" onChange={onChange} verdict={verdict} />
    </View>
  );
}

type Segment = { kind: 'word'; text: string } | { kind: 'gap'; index: number; trailing: string };

/**
 * Splits a gapped sentence into words and gaps so it wraps at word boundaries. Punctuation that
 * directly follows a gap (", thanks") stays glued to the gap instead of starting a new line.
 */
function segments(text: string): Segment[] {
  const out: Segment[] = [];
  text.split('___').forEach((part, i) => {
    let words = part.trim() ? part.trim().split(/\s+/) : [];
    if (i > 0) {
      const gap = out[out.length - 1] as Extract<Segment, { kind: 'gap' }>;
      const glued = /^[,.!?;:…»)]+/.exec(part)?.[0] ?? '';
      if (glued) {
        gap.trailing = glued;
        words = part.slice(glued.length).trim() ? part.slice(glued.length).trim().split(/\s+/) : [];
      }
    }
    for (const w of words) out.push({ kind: 'word', text: w });
    out.push({ kind: 'gap', index: i, trailing: '' });
  });
  out.pop(); // the loop adds one gap too many after the last part
  return out;
}

export function FillGapView({ exercise: ex, onChange, verdict }: ExerciseViewProps<'fill_gap'>) {
  const { colors, radius } = useTheme();
  const parts = ex.text.split('___');
  const gaps = parts.length - 1;
  const segs = useMemo(() => segments(ex.text), [ex.text]);
  const [values, setValues] = useState<string[]>(() => Array.from({ length: gaps }, () => ''));
  const set = (i: number, v: string) => {
    const next = values.map((old, j) => (j === i ? v : old));
    setValues(next);
    onChange(next.every((x) => x.trim()) ? { kind: 'gaps', values: next } : null);
  };
  const gapState = (i: number) =>
    !verdict ? 'idle' : (verdict.parts?.[i] ?? verdict.correct) ? 'correct' : 'wrong';

  return (
    <View style={common.stack}>
      <Instruction>{ex.options ? 'Выберите слово для пропуска' : 'Заполните пропуск'}</Instruction>
      <View
        style={[
          local.sentence,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        <SpeakButtons text={ex.text.replace(/___/g, '…')} label="Прослушать предложение" />
        <View style={local.sentenceText}>
          {segs.map((s, k) => {
            if (s.kind === 'word') {
              return (
                <AppText key={k} variant="prompt">
                  {s.text}
                </AppText>
              );
            }
            const i = s.index;
            const state = gapState(i);
            return (
              <View key={k} style={local.inline}>
                {ex.options ? (
                  <View
                    style={[
                      local.gap,
                      {
                        borderColor:
                          state === 'correct'
                            ? colors.success
                            : state === 'wrong'
                              ? colors.error
                              : colors.primary,
                      },
                    ]}
                  >
                    <AppText variant="prompt" color={values[i] ? 'text' : 'textMuted'}>
                      {values[i] || '   '}
                    </AppText>
                  </View>
                ) : (
                  <TextField
                    label={`Пропуск ${i + 1}`}
                    value={values[i]}
                    editable={!verdict}
                    state={state}
                    onChangeText={(t) => set(i, t)}
                    style={local.gapInput}
                  />
                )}
                {s.trailing ? <AppText variant="prompt">{s.trailing}</AppText> : null}
              </View>
            );
          })}
        </View>
      </View>
      {ex.cue && (
        <AppText variant="small" color="textMuted">
          Подсказка в скобках: ({ex.cue})
        </AppText>
      )}
      {ex.translation && (
        <AppText variant="small" color="textMuted">
          {ex.translation}
        </AppText>
      )}
      {ex.options && (
        <View style={common.wrapRow} role="radiogroup">
          {ex.options.map((o) => (
            <Choice
              key={o}
              label={o}
              state={values[0] === o ? 'selected' : 'idle'}
              disabled={!!verdict}
              onPress={() => set(0, o)}
              style={local.option}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 8 },
  tile: {
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  answer: {
    minHeight: 76,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  sentence: { borderWidth: 2, padding: 16, gap: 12 },
  sentenceText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
    columnGap: 6,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  gap: { minWidth: 72, borderBottomWidth: 3, paddingHorizontal: 6, alignItems: 'center' },
  gapInput: { minWidth: 110, minHeight: 48, paddingVertical: 6 },
  option: { flexGrow: 1, minWidth: 96 },
});

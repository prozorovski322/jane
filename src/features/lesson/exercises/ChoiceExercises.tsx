/**
 * Exercises answered by picking one option: translation, listen-and-choose, pictures,
 * minimal pairs, word stress.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { tts } from '@/core/speech/tts';
import { AppText } from '@/ui/components/AppText';
import { Choice } from '@/ui/components/Choice';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { Instruction, Prompt, optionState, styles as common, useOrder } from './common';
import type { ExerciseViewProps } from './types';

function OptionList({
  options,
  correct,
  seed,
  checked,
  onSelect,
}: {
  options: readonly string[];
  correct: number;
  seed: string;
  checked: boolean;
  onSelect: (index: number) => void;
}) {
  const order = useOrder(options.length, seed);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <View style={common.stack} role="radiogroup">
      {order.map((i, pos) => (
        <Choice
          key={i}
          index={pos + 1}
          label={options[i]}
          state={optionState(i, selected, correct, checked)}
          disabled={checked}
          onPress={() => {
            setSelected(i);
            onSelect(i);
          }}
        />
      ))}
    </View>
  );
}

export function TranslateChoiceView({
  exercise: ex,
  onChange,
  verdict,
  seed,
}: ExerciseViewProps<'translate_choice'>) {
  return (
    <View style={common.stack}>
      <Instruction>Выберите перевод</Instruction>
      <Prompt text={ex.text} lang={ex.from} />
      <OptionList
        options={ex.options}
        correct={ex.answer}
        seed={seed}
        checked={!!verdict}
        onSelect={(index) => onChange({ kind: 'choice', index })}
      />
    </View>
  );
}

/** Plays the audio once when the exercise appears, unless the learner cannot listen. */
function useAutoplay(text: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void tts.speak(text);
    return () => void tts.stop();
  }, [text, enabled]);
}

export function ListenChoiceView({
  exercise: ex,
  onChange,
  verdict,
  seed,
  ctx,
}: ExerciseViewProps<'listen_choice'>) {
  useAutoplay(ex.audio, !ctx.cantListen);
  return (
    <View style={common.stack}>
      <Instruction>{ex.question ?? 'Что вы слышите?'}</Instruction>
      <View style={local.center}>
        <SpeakButtons text={ex.audio} large label="Прослушать ещё раз" />
      </View>
      <OptionList
        options={ex.options}
        correct={ex.answer}
        seed={seed}
        checked={!!verdict}
        onSelect={(index) => onChange({ kind: 'choice', index })}
      />
    </View>
  );
}

export function PictureChoiceView({
  exercise: ex,
  onChange,
  verdict,
  seed,
  ctx,
}: ExerciseViewProps<'picture_choice'>) {
  const { colors } = useTheme();
  const ids = [ex.word, ...ex.distractors];
  const order = useOrder(ids.length, seed);
  const [selected, setSelected] = useState<number | null>(null);
  const target = ctx.word(ex.word);
  const emoji = (id: string) => {
    const p = ctx.word(id)?.picture;
    return p && 'emoji' in p ? p.emoji : '❔';
  };
  const select = (i: number) => {
    setSelected(i);
    onChange({ kind: 'word', wordId: ids[i]! });
  };

  if (ex.mode === 'word-to-picture') {
    return (
      <View style={common.stack}>
        <Instruction>Выберите картинку</Instruction>
        <Prompt text={target?.en ?? ex.word} lang="en" />
        <View style={local.grid}>
          {order.map((i) => (
            <Choice
              key={i}
              label={ctx.word(ids[i]!)?.ru[0] ?? ids[i]}
              state={optionState(i, selected, 0, !!verdict)}
              disabled={!!verdict}
              onPress={() => select(i)}
              style={local.card}
            >
              <AppText style={local.emoji} aria-hidden>
                {emoji(ids[i]!)}
              </AppText>
            </Choice>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={common.stack}>
      <Instruction>Что на картинке?</Instruction>
      <View style={[local.picture, { backgroundColor: colors.surfaceAlt }]}>
        <AppText style={local.bigEmoji} aria-label={target?.ru[0]}>
          {emoji(ex.word)}
        </AppText>
      </View>
      <OptionList
        options={ids.map((id) => ctx.word(id)?.en ?? id)}
        correct={0}
        seed={seed}
        checked={!!verdict}
        onSelect={select}
      />
    </View>
  );
}

export function MinimalPairView({
  exercise: ex,
  onChange,
  verdict,
  seed,
  ctx,
}: ExerciseViewProps<'minimal_pair'>) {
  const said = ex.pair[ex.say].en;
  useAutoplay(said, !ctx.cantListen);
  const order = useOrder(2, seed);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <View style={common.stack}>
      <Instruction>Какое слово вы слышите?</Instruction>
      <View style={local.center}>
        <SpeakButtons text={said} large label="Прослушать ещё раз" />
      </View>
      <View style={local.grid}>
        {order.map((i) => (
          <Choice
            key={i}
            label={ex.pair[i]!.en}
            state={optionState(i, selected, ex.say, !!verdict)}
            disabled={!!verdict}
            style={local.card}
            onPress={() => {
              setSelected(i);
              onChange({ kind: 'choice', index: i });
            }}
          >
            <AppText variant="title" align="center">
              {ex.pair[i]!.en}
            </AppText>
            <AppText variant="small" color="textMuted" align="center">
              /{ex.pair[i]!.ipa}/
            </AppText>
          </Choice>
        ))}
      </View>
    </View>
  );
}

export function WordStressView({
  exercise: ex,
  onChange,
  verdict,
}: ExerciseViewProps<'word_stress'>) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <View style={common.stack}>
      <Instruction>На какой слог ударение?</Instruction>
      <Prompt text={ex.word} lang="en" />
      <View style={local.syllables} role="radiogroup">
        {ex.syllables.map((s, i) => (
          <Choice
            key={i}
            label={`${s}, слог ${i + 1}`}
            state={optionState(i, selected, ex.stress, !!verdict)}
            disabled={!!verdict}
            style={local.syllable}
            onPress={() => {
              setSelected(i);
              onChange({ kind: 'choice', index: i });
            }}
          >
            <AppText variant="title" align="center">
              {s}
            </AppText>
          </Choice>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: '45%', flexGrow: 1, minHeight: 120, justifyContent: 'center' },
  emoji: { fontSize: 56, lineHeight: 68, textAlign: 'center' },
  picture: { alignSelf: 'center', borderRadius: 24, padding: 16 },
  bigEmoji: { fontSize: 96, lineHeight: 112, textAlign: 'center' },
  syllables: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  syllable: { flexGrow: 1, minWidth: 80 },
});

/**
 * Speaking and writing. Speaking works in three ways:
 * - speech recognition, when the device supports it (stage 7);
 * - self-check: say it aloud, then compare with the sample and judge honestly;
 * - typed answer, for learners who cannot speak right now (accessibility).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { countWords } from '@/core/content/lexical';
import { recognizer, speechErrorMessage } from '@/core/speech/stt';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Choice } from '@/ui/components/Choice';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { AiReviewCard } from './AiReviewCard';
import { Instruction, Prompt, styles as common } from './common';
import { SelfRecorder } from './SelfRecorder';
import type { ExerciseViewProps } from './types';

type SpeakMode = 'choose' | 'listening' | 'self' | 'typed';

export function SpeakView({
  exercise: ex,
  onChange,
  verdict,
}: ExerciseViewProps<'speak_repeat' | 'speak_answer' | 'speak_describe'>) {
  const { colors, radius } = useTheme();
  const [mode, setMode] = useState<SpeakMode>('choose');
  const [canRecognize, setCanRecognize] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [self, setSelf] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [interim, setInterim] = useState('');

  useEffect(() => {
    let alive = true;
    void recognizer.isAvailable().then((ok) => alive && setCanRecognize(ok));
    return () => {
      alive = false;
      recognizer.stop();
    };
  }, []);

  const sample = ex.type === 'speak_repeat' ? ex.text : ex.samples[0]!;

  const listen = async () => {
    setMode('listening');
    setHeard(null);
    setNotice(null);
    try {
      const transcript = await recognizer.listen({
        lang: 'en-US',
        contextualStrings: [sample],
        onInterim: setInterim,
      });
      setHeard(transcript);
      onChange({ kind: 'speech', transcript });
    } catch (e) {
      // Not heard or no microphone: say why and let the learner try again or check themselves.
      setNotice(speechErrorMessage(e));
      setInterim('');
      setMode('choose');
    }
  };

  return (
    <View style={common.stack}>
      {ex.type === 'speak_repeat' && (
        <>
          <Instruction>Послушайте и повторите вслух</Instruction>
          <Prompt text={ex.text} lang="en" />
        </>
      )}
      {ex.type === 'speak_answer' && (
        <>
          <Instruction>Ответьте на вопрос вслух</Instruction>
          <Prompt text={ex.question} lang="en" />
          <AppText variant="small" color="textMuted">
            {ex.questionRu}
          </AppText>
        </>
      )}
      {ex.type === 'speak_describe' && (
        <>
          <Instruction>Расскажите вслух</Instruction>
          <View
            style={[local.picture, { backgroundColor: colors.surfaceAlt, borderRadius: radius.xl }]}
          >
            <AppText style={local.emoji} aria-hidden>
              {'emoji' in ex.picture ? ex.picture.emoji : '🖼️'}
            </AppText>
          </View>
          <AppText variant="body">{ex.situation}</AppText>
        </>
      )}

      {!verdict && mode === 'choose' && (
        <View style={common.stack}>
          {notice && (
            <AppText variant="small" color="textMuted" aria-live="polite">
              {notice}
            </AppText>
          )}
          {canRecognize && <Button label="Говорить" icon="mic" onPress={() => void listen()} />}
          <Button
            label={canRecognize ? 'Проверю себя сам' : 'Сказать и проверить себя'}
            icon="mic"
            variant={canRecognize ? 'secondary' : 'primary'}
            onPress={() => setMode('self')}
          />
          <Button
            label="Ответить текстом"
            icon="keyboard"
            variant="secondary"
            onPress={() => setMode('typed')}
          />
        </View>
      )}

      {mode === 'listening' && heard === null && (
        <View style={common.stack}>
          <AppText variant="body" color="textMuted" align="center" aria-live="polite">
            {interim ? `Слышу: «${interim}»` : 'Слушаю…'}
          </AppText>
          <Button label="Хватит" variant="secondary" compact onPress={() => recognizer.stop()} />
        </View>
      )}
      {heard !== null && (
        <AppText variant="body" aria-live="polite">
          Распознано: «{heard}»
        </AppText>
      )}

      {mode === 'self' && (
        <View style={common.stack}>
          <AppText variant="body">
            {ex.type === 'speak_repeat'
              ? 'Скажите фразу вслух, потом послушайте образец ещё раз.'
              : 'Скажите ответ вслух, потом откройте пример и сравните.'}
          </AppText>
          <SelfRecorder />
          {!revealed ? (
            <Button
              label="Я сказал(а), показать образец"
              variant="secondary"
              icon="eye"
              onPress={() => setRevealed(true)}
            />
          ) : (
            <>
              <View
                style={[
                  local.sample,
                  { backgroundColor: colors.primarySoft, borderRadius: radius.lg },
                ]}
              >
                <SpeakButtons text={sample} label="Прослушать образец" />
                <AppText variant="bodyStrong" style={common.flex}>
                  {sample}
                </AppText>
              </View>
              <AppText variant="small" color="textMuted">
                Совпало по смыслу и звучанию?
              </AppText>
              <View style={common.wrapRow} role="radiogroup">
                {[
                  { ok: true, label: 'Да, получилось' },
                  { ok: false, label: 'Нет, ещё потренируюсь' },
                ].map((o) => (
                  <Choice
                    key={String(o.ok)}
                    label={o.label}
                    state={self === o.ok ? 'selected' : 'idle'}
                    disabled={!!verdict}
                    style={local.half}
                    onPress={() => {
                      setSelf(o.ok);
                      onChange({ kind: 'self', ok: o.ok });
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {mode === 'typed' && (
        <TextField
          label="Ваш ответ"
          placeholder="Напишите по-английски"
          value={typed}
          editable={!verdict}
          state={verdict ? (verdict.correct ? 'correct' : 'wrong') : 'idle'}
          onChangeText={(t) => {
            setTyped(t);
            onChange(t.trim() ? { kind: 'text', text: t } : null);
          }}
        />
      )}
    </View>
  );
}

export function WriteView({ exercise: ex, onChange, verdict }: ExerciseViewProps<'write'>) {
  const [text, setText] = useState('');
  const words = countWords(text);
  const inRange = words >= ex.minWords && words <= ex.maxWords;
  return (
    <View style={common.stack}>
      <Instruction>Напишите короткий текст</Instruction>
      <AppText variant="body">{ex.task}</AppText>
      <TextField
        label="Ваш текст"
        placeholder="Пишите по-английски"
        multiline
        value={text}
        editable={!verdict}
        state={verdict ? (verdict.correct ? 'correct' : 'wrong') : 'idle'}
        onChangeText={(t) => {
          setText(t);
          onChange(t.trim() ? { kind: 'text', text: t } : null);
        }}
      />
      <AppText variant="caption" color={inRange ? 'success' : 'textMuted'} aria-live="polite">
        Слов: {words} (нужно {ex.minWords}–{ex.maxWords})
      </AppText>
      {verdict && <AiReviewCard task={ex.task} text={text} />}
    </View>
  );
}

const local = StyleSheet.create({
  picture: { alignSelf: 'center', padding: 16 },
  emoji: { fontSize: 88, lineHeight: 104, textAlign: 'center' },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  half: { flexGrow: 1, minWidth: 140 },
});

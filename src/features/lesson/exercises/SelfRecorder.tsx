/**
 * Self-check recorder: the learner records themselves, plays the recording back and then
 * compares it with the sample. The recording stays in the app cache and is deleted when the
 * exercise is left or the learner records again; it is never uploaded.
 */
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';

import { styles as common } from './common';

type Phase = 'idle' | 'recording' | 'recorded' | 'playing' | 'denied' | 'failed';

function discard(uri: string | null) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone or never written: nothing to clean up.
  }
}

export function SelfRecorder({ onRecorded }: { onRecorded?: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const player = useRef<AudioPlayer | null>(null);
  const saved = useRef<string | null>(null);

  const dropPlayer = () => {
    player.current?.release();
    player.current = null;
  };

  useEffect(
    () => () => {
      dropPlayer();
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // The recorder is already released.
      }
      discard(saved.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only, on unmount
    [],
  );

  const start = async () => {
    dropPlayer();
    discard(saved.current);
    saved.current = null;
    try {
      if (!(await requestRecordingPermissionsAsync()).granted) {
        setPhase('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      setPhase('failed');
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      saved.current = recorder.uri;
      if (!saved.current) throw new Error('no recording');
      setPhase('recorded');
      onRecorded?.();
    } catch {
      setPhase('failed');
    }
  };

  const play = () => {
    if (!saved.current) return;
    dropPlayer();
    const p = createAudioPlayer(saved.current);
    p.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) setPhase('recorded');
    });
    player.current = p;
    setPhase('playing');
    p.play();
  };

  const stopPlayback = () => {
    player.current?.pause();
    setPhase('recorded');
  };

  return (
    <View style={common.stack}>
      {phase === 'idle' && <Button label="Записать себя" icon="mic" onPress={() => void start()} />}
      {phase === 'recording' && (
        <>
          <AppText variant="body" color="textMuted" align="center" aria-live="polite">
            Идёт запись… Скажите вслух и нажмите «Стоп».
          </AppText>
          <Button label="Стоп" icon="close" onPress={() => void stop()} />
        </>
      )}
      {(phase === 'recorded' || phase === 'playing') && (
        <View style={common.wrapRow}>
          <Button
            label={phase === 'playing' ? 'Остановить' : 'Послушать себя'}
            icon="speaker"
            variant="secondary"
            compact
            onPress={phase === 'playing' ? stopPlayback : play}
          />
          <Button
            label="Записать заново"
            icon="mic"
            variant="ghost"
            compact
            onPress={() => void start()}
          />
        </View>
      )}
      {phase === 'denied' && (
        <AppText variant="small" color="textMuted" aria-live="polite">
          Нет доступа к микрофону. Можно просто сказать вслух и сравнить с образцом.
        </AppText>
      )}
      {phase === 'failed' && (
        <>
          <AppText variant="small" color="textMuted" aria-live="polite">
            Запись не получилась. Можно просто сказать вслух и сравнить с образцом.
          </AppText>
          <Button
            label="Попробовать ещё раз"
            variant="ghost"
            compact
            onPress={() => void start()}
          />
        </>
      )}
    </View>
  );
}

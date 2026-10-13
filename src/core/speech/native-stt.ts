/**
 * The native recognizer built on expo-speech-recognition. The module only exists in a development
 * build (or a store build), not in Expo Go, so it is loaded lazily and any failure to load simply
 * leaves speaking exercises in self-check mode.
 */
import { Platform } from 'react-native';

import { useSettings } from '@/features/settings/store';

import {
  setRecognizer,
  SpeechError,
  type ListenOptions,
  type SpeechErrorCode,
  type SpeechRecognizer,
} from './stt';

interface Subscription {
  remove(): void;
}

/** The part of the native module this app uses; a fake stands in for it in tests. */
export interface NativeSpeechModule {
  start(options: {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    contextualStrings?: string[];
    requiresOnDeviceRecognition: boolean;
    addsPunctuation: boolean;
  }): void;
  stop(): void;
  abort(): void;
  addListener(event: 'result', cb: (e: NativeResultEvent) => void): Subscription;
  addListener(event: 'error', cb: (e: { error: string; message: string }) => void): Subscription;
  addListener(event: 'end', cb: () => void): Subscription;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  supportsOnDeviceRecognition(): boolean;
}

export interface NativeResultEvent {
  isFinal: boolean;
  results: { transcript: string }[];
}

/** Longest a single attempt may take before it is stopped and what was heard is used. */
const MAX_LISTEN_MS = 15_000;

function errorCode(native: string): SpeechErrorCode {
  switch (native) {
    case 'no-speech':
    case 'nomatch':
      return 'no-speech';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    default:
      return 'failed';
  }
}

export function createNativeRecognizer(
  mod: NativeSpeechModule,
  allowCloud: () => boolean = () => useSettings.getState().cloudSpeech,
): SpeechRecognizer {
  // Cloud recognition sends audio to Apple or Google: only when the learner has allowed it.
  const usable = () =>
    mod.isRecognitionAvailable() && (mod.supportsOnDeviceRecognition() || allowCloud());

  return {
    async isAvailable() {
      try {
        return usable();
      } catch {
        return false;
      }
    },

    listen(opts: ListenOptions) {
      return new Promise<string>((resolve, reject) => {
        const subs: Subscription[] = [];
        let heard = '';
        let done = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          subs.forEach((s) => s.remove());
          fn();
        };
        const finishWithHeard = () =>
          finish(() =>
            heard.trim() ? resolve(heard.trim()) : reject(new SpeechError('no-speech')),
          );

        void (async () => {
          try {
            if (!usable()) throw new SpeechError('unavailable');
            const permission = await mod.requestPermissionsAsync();
            if (!permission.granted) throw new SpeechError('not-allowed');

            subs.push(
              mod.addListener('result', (e) => {
                heard = e.results[0]?.transcript ?? heard;
                if (e.isFinal) finishWithHeard();
                else if (heard) opts.onInterim?.(heard);
              }),
              mod.addListener('error', (e) => {
                const code = errorCode(e.error);
                // Some recognizers report "no speech" after a partial result: keep what we have.
                if (code === 'no-speech' && heard.trim()) finishWithHeard();
                else finish(() => reject(new SpeechError(code, e.message)));
              }),
              mod.addListener('end', finishWithHeard),
            );

            mod.start({
              lang: opts.lang,
              interimResults: true,
              continuous: false,
              contextualStrings: opts.contextualStrings,
              requiresOnDeviceRecognition: mod.supportsOnDeviceRecognition(),
              addsPunctuation: false,
            });
            timer = setTimeout(() => mod.stop(), MAX_LISTEN_MS);
          } catch (e) {
            finish(() =>
              reject(e instanceof SpeechError ? e : new SpeechError('failed', String(e))),
            );
          }
        })();
      });
    },

    stop() {
      try {
        mod.stop();
      } catch {
        // Nothing is being recognized: nothing to stop.
      }
    },
  };
}

/** Registers the native recognizer when the module is present. Safe to call anywhere. */
export function registerNativeRecognizer(): boolean {
  // The web build would use the browser's recognition, which sends audio to Google: not used.
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: NativeSpeechModule;
    };
    setRecognizer(createNativeRecognizer(ExpoSpeechRecognitionModule));
    return true;
  } catch {
    return false;
  }
}

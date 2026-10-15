/**
 * Speech recognition on the website, built on the browser's Web Speech API. Browsers send the
 * audio to their own servers (Google in Chrome, Apple in Safari, Microsoft in Edge), so like the
 * phone's cloud recognizer it is used only when the learner has allowed it in the settings;
 * otherwise speaking exercises stay in self-check mode.
 */
import { useSettings } from '@/features/settings/store';

import {
  setRecognizer,
  SpeechError,
  type ListenOptions,
  type SpeechErrorCode,
  type SpeechRecognizer,
} from './stt';

/** The part of the browser's SpeechRecognition object this app uses; a fake stands in for tests. */
export interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: BrowserResultEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface BrowserResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export type BrowserRecognitionConstructor = new () => BrowserRecognition;

/** Longest a single attempt may take before it is stopped and what was heard is used. */
const MAX_LISTEN_MS = 15_000;

function errorCode(browser: string): SpeechErrorCode {
  switch (browser) {
    case 'no-speech':
      return 'no-speech';
    case 'not-allowed':
    case 'service-not-allowed':
    case 'audio-capture':
      return 'not-allowed';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    default:
      return 'failed';
  }
}

/** Everything heard so far, final and interim parts together. */
function transcriptOf(e: BrowserResultEvent): { text: string; final: boolean } {
  let text = '';
  let final = true;
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i]!;
    text += r[0]?.transcript ?? '';
    if (!r.isFinal) final = false;
  }
  return { text, final };
}

export function createWebRecognizer(
  Recognition: BrowserRecognitionConstructor,
  allowCloud: () => boolean = () => useSettings.getState().cloudSpeech,
): SpeechRecognizer {
  let current: BrowserRecognition | null = null;

  return {
    async isAvailable() {
      return allowCloud();
    },

    listen(opts: ListenOptions) {
      return new Promise<string>((resolve, reject) => {
        let heard = '';
        let done = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let rec: BrowserRecognition;

        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          rec.onresult = rec.onerror = rec.onend = null;
          if (current === rec) current = null;
          fn();
        };
        const finishWithHeard = () =>
          finish(() =>
            heard.trim() ? resolve(heard.trim()) : reject(new SpeechError('no-speech')),
          );

        try {
          if (!allowCloud()) throw new SpeechError('unavailable');
          rec = new Recognition();
          rec.lang = opts.lang;
          rec.interimResults = true;
          rec.continuous = false;
          rec.maxAlternatives = 1;
          rec.onresult = (e) => {
            const { text, final } = transcriptOf(e);
            heard = text || heard;
            if (final) finishWithHeard();
            else if (heard) opts.onInterim?.(heard);
          };
          rec.onerror = (e) => {
            const code = errorCode(e.error);
            // Chrome reports "no speech" after a partial result now and then: keep what we have.
            if (code === 'no-speech' && heard.trim()) finishWithHeard();
            else finish(() => reject(new SpeechError(code, e.message)));
          };
          rec.onend = finishWithHeard;
          current = rec;
          // The browser asks for the microphone itself the first time.
          rec.start();
          timer = setTimeout(() => rec.stop(), MAX_LISTEN_MS);
        } catch (e) {
          done = true;
          reject(e instanceof SpeechError ? e : new SpeechError('failed', String(e)));
        }
      });
    },

    stop() {
      try {
        current?.stop();
      } catch {
        // Nothing is being recognized: nothing to stop.
      }
    },
  };
}

/** The browser's recognizer class, if this browser has one. */
export function browserRecognition(): BrowserRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: BrowserRecognitionConstructor;
    webkitSpeechRecognition?: BrowserRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Registers the browser's recognizer when it exists. Safe to call anywhere. */
export function registerWebRecognizer(): boolean {
  const Recognition = browserRecognition();
  if (!Recognition) return false;
  setRecognizer(createWebRecognizer(Recognition));
  return true;
}

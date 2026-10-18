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
/** A long answer restarts a session the browser ended; this many times at most. */
const MAX_RESTARTS = 20;

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
  /** Ends the listening in progress for good (a long answer would otherwise restart). */
  let stopCurrent: (() => void) | null = null;

  return {
    async isAvailable() {
      return allowCloud();
    },

    listen(opts: ListenOptions) {
      return new Promise<string>((resolve, reject) => {
        const long = !!opts.long;
        // A long answer may span several browser sessions: what earlier ones heard is kept here.
        let committed = '';
        let heard = '';
        let done = false;
        let stopping = false;
        let restarts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let rec: BrowserRecognition;

        const all = () => [committed, heard].filter((s) => s.trim()).join(' ');
        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          rec.onresult = rec.onerror = rec.onend = null;
          if (current === rec) current = null;
          stopCurrent = null;
          fn();
        };
        const finishWithHeard = () =>
          finish(() => {
            const text = all().trim();
            if (text) resolve(text);
            else reject(new SpeechError('no-speech'));
          });

        const startSession = () => {
          rec = new Recognition();
          rec.lang = opts.lang;
          rec.interimResults = true;
          rec.continuous = long;
          rec.maxAlternatives = 1;
          rec.onresult = (e) => {
            const { text, final } = transcriptOf(e);
            heard = text || heard;
            if (final && !long) finishWithHeard();
            else if (all()) opts.onInterim?.(all());
          };
          rec.onerror = (e) => {
            const code = errorCode(e.error);
            // Chrome reports "no speech" after a partial result now and then: keep what we have.
            if (code === 'no-speech' && (long || all().trim())) {
              if (!long) finishWithHeard();
            } else finish(() => reject(new SpeechError(code, e.message)));
          };
          rec.onend = () => {
            // Browsers end even a continuous session after a while or a long pause: in a long
            // answer that is not the learner's choice, so listening goes on in a new session.
            if (long && !stopping && restarts++ < MAX_RESTARTS) {
              committed = all();
              heard = '';
              startSession();
            } else finishWithHeard();
          };
          current = rec;
          // The browser asks for the microphone itself the first time.
          rec.start();
        };

        const stopListening = () => {
          stopping = true;
          rec.stop();
        };

        try {
          if (!allowCloud()) throw new SpeechError('unavailable');
          stopCurrent = stopListening;
          startSession();
          timer = setTimeout(stopListening, opts.long?.maxMs ?? MAX_LISTEN_MS);
        } catch (e) {
          done = true;
          stopCurrent = null;
          reject(e instanceof SpeechError ? e : new SpeechError('failed', String(e)));
        }
      });
    },

    stop() {
      try {
        if (stopCurrent) stopCurrent();
        else current?.stop();
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

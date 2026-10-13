/**
 * Speech recognition. The native recognizer (expo-speech-recognition, dev build only) is wired
 * in stage 7; until then no recognizer is available and speaking exercises offer self-check
 * and a typed answer. Recordings never leave the device.
 */

export interface SpeechRecognizer {
  /** Whether recognition can run right now (module present, permission granted). */
  isAvailable(): Promise<boolean>;
  /** Listens until the learner stops talking; resolves with what was heard. */
  listen(opts: { lang: 'en-US'; contextualStrings?: string[] }): Promise<string>;
  stop(): void;
}

export const unavailableRecognizer: SpeechRecognizer = {
  isAvailable: async () => false,
  listen: async () => {
    throw new Error('Speech recognition is not available');
  },
  stop: () => {},
};

export let recognizer: SpeechRecognizer = unavailableRecognizer;

export function setRecognizer(r: SpeechRecognizer) {
  recognizer = r;
}

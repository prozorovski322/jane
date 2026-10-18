/**
 * Speech recognition. The native recognizer (expo-speech-recognition, dev build only) is created
 * in `native-stt.ts` at startup; in Expo Go and on the web no recognizer is available and speaking
 * exercises offer a self-check with recording and a typed answer.
 *
 * Privacy: by default recognition runs on the device only. A recognizer that would send audio to
 * an Apple/Google server is used only when the learner has allowed it in the settings.
 */

export type SpeechErrorCode =
  'no-speech' | 'not-allowed' | 'unavailable' | 'network' | 'aborted' | 'failed';

export class SpeechError extends Error {
  constructor(
    readonly code: SpeechErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SpeechError';
  }
}

export interface ListenOptions {
  lang: 'en-US';
  /** Phrases the recognizer should prefer (the expected answer). */
  contextualStrings?: string[];
  /** Called with the text heard so far while the learner is still talking. */
  onInterim?: (text: string) => void;
  /**
   * A long answer (an exam monologue): keep listening through pauses until `stop()` or until
   * `maxMs` has passed, instead of ending at the first pause.
   */
  long?: { maxMs: number };
}

export interface SpeechRecognizer {
  /** Whether recognition can run right now (module present, on-device or allowed by the learner). */
  isAvailable(): Promise<boolean>;
  /** Listens until the learner stops talking; resolves with what was heard. */
  listen(opts: ListenOptions): Promise<string>;
  /** Ends listening and delivers what was heard so far. */
  stop(): void;
}

export const unavailableRecognizer: SpeechRecognizer = {
  isAvailable: async () => false,
  listen: async () => {
    throw new SpeechError('unavailable', 'Speech recognition is not available');
  },
  stop: () => {},
};

export let recognizer: SpeechRecognizer = unavailableRecognizer;

export function setRecognizer(r: SpeechRecognizer) {
  recognizer = r;
}

/** What the learner should do after a failed attempt, in Russian. */
export function speechErrorMessage(e: unknown): string {
  const code = e instanceof SpeechError ? e.code : 'failed';
  switch (code) {
    case 'no-speech':
      return 'Не расслышал. Попробуйте ещё раз — говорите чуть громче и ближе к микрофону.';
    case 'not-allowed':
      return 'Нет доступа к микрофону. Разрешите его в настройках телефона или проверьте себя сами.';
    case 'network':
      return 'Нет связи с сервисом распознавания. Проверьте себя сами или ответьте текстом.';
    case 'aborted':
      return 'Запись остановлена.';
    default:
      return 'Не получилось распознать речь. Проверьте себя сами или ответьте текстом.';
  }
}

/**
 * Text-to-speech. The provider interface lets recorded course audio replace device TTS later
 * without touching the screens.
 */
import * as Speech from 'expo-speech';

import { useSettings } from '@/features/settings/store';

export type VoiceGender = 'female' | 'male';

export interface SpeakOptions {
  slow?: boolean;
  voice?: VoiceGender;
}

export interface TtsProvider {
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  stop(): Promise<void>;
}

// Voice names that ship with iOS, Android and desktop browsers; used to honor a speaker's gender.
const FEMALE =
  /samantha|ava|allison|susan|zoe|nicky|karen|moira|tessa|victoria|serena|kate|female|zira|aria|jenny|sara|en-us-x-(sfg|iob|tpc)/i;
const MALE =
  /alex|daniel|fred|tom|aaron|arthur|evan|nathan|male|david|guy|mark|en-us-x-(iol|iom|tpd)/i;

let voices: Speech.Voice[] | null = null;

async function englishVoices(): Promise<Speech.Voice[]> {
  if (!voices) {
    try {
      const all = await Speech.getAvailableVoicesAsync();
      voices = all.filter((v) => /^en[-_]US/i.test(v.language));
    } catch {
      voices = [];
    }
  }
  return voices;
}

async function pickVoice(gender?: VoiceGender): Promise<string | undefined> {
  const preferred = useSettings.getState().voice;
  if (preferred && !gender) return preferred;
  const list = await englishVoices();
  if (!gender) return list.find((v) => v.quality === Speech.VoiceQuality.Enhanced)?.identifier;
  const re = gender === 'female' ? FEMALE : MALE;
  const other = gender === 'female' ? MALE : FEMALE;
  return (
    list.find((v) => re.test(v.name) && !other.test(v.name))?.identifier ?? preferred ?? undefined
  );
}

export const deviceTts: TtsProvider = {
  async speak(text, opts = {}) {
    const rate = useSettings.getState().speechRate * (opts.slow ? 0.6 : 1);
    const voice = await pickVoice(opts.voice);
    await Speech.stop();
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        rate,
        voice,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  },
  async stop() {
    await Speech.stop();
  },
};

export let tts: TtsProvider = deviceTts;

/** Swap the provider (recorded audio, tests). */
export function setTtsProvider(provider: TtsProvider) {
  tts = provider;
}

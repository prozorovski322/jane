import * as Speech from 'expo-speech';

export interface VoiceOption {
  id: string;
  name: string;
}

/** English (US) voices installed on this device, best quality first. */
export async function listEnglishVoices(): Promise<VoiceOption[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return all
      .filter((v) => /^en[-_]US/i.test(v.language))
      .sort(
        (a, b) =>
          Number(b.quality === Speech.VoiceQuality.Enhanced) -
            Number(a.quality === Speech.VoiceQuality.Enhanced) || a.name.localeCompare(b.name),
      )
      .slice(0, 8)
      .map((v) => ({ id: v.identifier, name: v.name }));
  } catch {
    return [];
  }
}

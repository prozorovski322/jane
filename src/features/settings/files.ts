/**
 * Saving and opening the learner's progress file. On a phone the file goes through the system
 * share sheet (save to Files, send to yourself, …); in a browser it is downloaded. Nothing is
 * uploaded anywhere by the app itself.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type SaveOutcome = 'shared' | 'downloaded' | 'unavailable';

export async function saveJsonFile(name: string, text: string): Promise<SaveOutcome> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Резервная копия Jane',
    UTI: 'public.json',
  });
  return 'shared';
}

/** Lets the learner pick a backup file; resolves with its text, or null if they cancel. */
export async function pickJsonFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  // On the web the picked File object is available directly.
  if (asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

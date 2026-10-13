/**
 * The learner's own API key for the optional AI review. It lives only in the device's secure
 * storage (Keychain / Keystore) — never in the database, in backups or in logs. On platforms
 * without secure storage (web) the feature is simply unavailable.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'jane.ai-key';

export async function getAiKey(): Promise<string | null> {
  try {
    if (!(await SecureStore.isAvailableAsync())) return null;
    return (await SecureStore.getItemAsync(KEY)) || null;
  } catch {
    return null;
  }
}

/** Saves the key; false if secure storage is not available here. */
export async function setAiKey(key: string): Promise<boolean> {
  try {
    if (!(await SecureStore.isAvailableAsync())) return false;
    await SecureStore.setItemAsync(KEY, key.trim());
    return true;
  } catch {
    return false;
  }
}

export async function clearAiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored or no secure storage: nothing to clear.
  }
}

export async function aiKeySupported(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

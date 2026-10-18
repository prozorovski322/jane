/**
 * Website version of the permission requests: no notifications (the site has no reminders, and
 * loading expo-notifications only prints a console warning); the microphone works as in the app.
 */
import { requestRecordingPermissionsAsync } from 'expo-audio';

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

export async function requestNotifications(): Promise<PermissionOutcome> {
  return 'unavailable';
}

export async function requestMicrophone(): Promise<PermissionOutcome> {
  try {
    const r = await requestRecordingPermissionsAsync();
    return r.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Permission requests with one simple outcome. "unavailable" covers platforms without the
 * capability (e.g. notifications in some browsers); callers treat it like "not now".
 */
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

export async function requestNotifications(): Promise<PermissionOutcome> {
  try {
    const r = await Notifications.requestPermissionsAsync();
    return r.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function requestMicrophone(): Promise<PermissionOutcome> {
  try {
    const r = await requestRecordingPermissionsAsync();
    return r.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Jane runs as a website and as a phone app from the same code. Screens use this flag where the
 * two differ: no reminders or vibration in a browser, browser speech recognition, data kept in
 * the browser rather than on the phone.
 */
import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

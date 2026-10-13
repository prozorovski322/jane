/**
 * Tactile and audio response to user actions. Every call is fire-and-forget and never
 * throws: feedback must not break a lesson on a device without a vibration motor.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettings } from '@/features/settings/store';

import { playSound } from './sounds';

function enabled(): boolean {
  return Platform.OS !== 'web' && useSettings.getState().haptics;
}

function run(fn: () => Promise<void>) {
  if (!enabled()) return;
  fn().catch(() => {});
}

export const feedback = {
  /** Selecting an option, placing a tile. */
  tap: () => run(() => Haptics.selectionAsync()),
  correct: () => {
    playSound('correct');
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  wrong: () => {
    playSound('wrong');
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  /** Finishing a lesson or reaching a goal. */
  celebrate: () => {
    playSound('complete');
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  /** Unlocking an achievement. */
  achievement: () => {
    playSound('achievement');
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
};

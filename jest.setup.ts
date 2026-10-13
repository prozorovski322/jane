/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// The native audio module does not exist in tests: a recorder that "records" instantly and a
// player that finishes at once are enough for the screens.
jest.mock('expo-audio', () => {
  const recorder = () => ({
    isRecording: false,
    uri: 'file:///cache/recording.m4a',
    prepareToRecordAsync: jest.fn(async () => {}),
    record: jest.fn(),
    stop: jest.fn(async () => {}),
  });
  const player = () => ({
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  });
  return {
    RecordingPresets: { HIGH_QUALITY: {} },
    useAudioRecorder: jest.fn(recorder),
    createAudioPlayer: jest.fn(player),
    setAudioModeAsync: jest.fn(async () => {}),
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  };
});

// Audio is not available in tests; screens only need speak() to resolve.
jest.mock('@/core/speech/tts', () => {
  const provider = { speak: jest.fn(async () => {}), stop: jest.fn(async () => {}) };
  return { tts: provider, deviceTts: provider, setTtsProvider: jest.fn() };
});

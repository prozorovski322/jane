/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Audio is not available in tests; screens only need speak() to resolve.
jest.mock('@/core/speech/tts', () => {
  const provider = { speak: jest.fn(async () => {}), stop: jest.fn(async () => {}) };
  return { tts: provider, deviceTts: provider, setTtsProvider: jest.fn() };
});

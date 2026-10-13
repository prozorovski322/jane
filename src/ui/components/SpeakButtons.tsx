import { StyleSheet, View } from 'react-native';

import { tts, type VoiceGender } from '@/core/speech/tts';

import { IconButton } from './IconButton';

/** Play a phrase at normal and slow speed. */
export function SpeakButtons({
  text,
  voice,
  large,
  label = 'Прослушать',
}: {
  text: string;
  voice?: VoiceGender;
  large?: boolean;
  label?: string;
}) {
  return (
    <View style={styles.row}>
      <IconButton
        icon="speaker"
        label={label}
        filled
        size={large ? 34 : 24}
        onPress={() => void tts.speak(text, { voice })}
      />
      <IconButton
        icon="speaker-slow"
        label={`${label} медленно`}
        color="primary"
        size={large ? 26 : 22}
        onPress={() => void tts.speak(text, { voice, slow: true })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

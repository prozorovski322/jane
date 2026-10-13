import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { SubScreen } from '@/ui/components/SubScreen';

import { PRIVACY_SECTIONS } from './privacy';

export function PrivacyScreen() {
  return (
    <SubScreen title="Конфиденциальность">
      {PRIVACY_SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: 8 }}>
          <AppText variant="heading" role="heading">
            {s.title}
          </AppText>
          {s.paragraphs.map((p, i) => (
            <AppText key={i} variant="body">
              {p}
            </AppText>
          ))}
        </View>
      ))}
    </SubScreen>
  );
}

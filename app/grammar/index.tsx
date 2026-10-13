import { useLocalSearchParams } from 'expo-router';

import { GrammarListScreen } from '@/features/grammar/GrammarScreens';

export default function GrammarListRoute() {
  const { unit } = useLocalSearchParams<{ unit?: string }>();
  return <GrammarListScreen unitId={unit || undefined} />;
}

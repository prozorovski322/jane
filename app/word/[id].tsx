import { useLocalSearchParams } from 'expo-router';

import { WordScreen } from '@/features/dictionary/WordScreen';

export default function WordRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WordScreen id={id} />;
}

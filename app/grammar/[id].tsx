import { useLocalSearchParams } from 'expo-router';

import { GrammarNoteScreen } from '@/features/grammar/GrammarScreens';

export default function GrammarNoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GrammarNoteScreen id={id} />;
}

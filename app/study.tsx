import { useLocalSearchParams } from 'expo-router';
import { StudyScreen } from '@/features/study/StudyScreen';

export default function StudyRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <StudyScreen id={typeof id === 'string' ? id : undefined} />;
}

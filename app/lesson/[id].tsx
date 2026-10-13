import { router, useLocalSearchParams } from 'expo-router';

import { LessonScreen } from '@/features/lesson/LessonScreen';

export default function LessonRoute() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  // `?start=N` opens a lesson at exercise N; a development aid for reviewing content.
  const startAt = __DEV__ && start ? Math.max(0, Number(start) || 0) : 0;
  // Results are saved to progress storage in stage 4.
  return (
    <LessonScreen
      lessonId={id}
      startAt={startAt}
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

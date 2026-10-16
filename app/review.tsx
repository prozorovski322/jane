import { router } from 'expo-router';

import { getDb } from '@/core/storage';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { useProgress } from '@/features/progress/store';
import { loadReviewSession } from '@/features/review/sources';
import { useLoad } from '@/lib/useLoad';
import { LoadFailed } from '@/ui/components/LoadFailed';

const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ReviewRoute() {
  const loaded = useLoad(
    () =>
      loadReviewSession(
        getDb(),
        useProgress.getState().snapshot?.completedLessons ?? new Set<string>(),
      ),
    [],
  );

  if (loaded.status === 'failed') return <LoadFailed onRetry={loaded.retry} onExit={exit} />;
  if (loaded.status === 'loading') return null;

  return (
    <LessonScreen
      session={loaded.value}
      onComplete={(summary) =>
        useProgress
          .getState()
          .record(getDb(), { id: 'review', unitId: null, kind: 'review' }, summary)
      }
      onExit={exit}
    />
  );
}

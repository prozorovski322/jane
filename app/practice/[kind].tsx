import { router, useLocalSearchParams } from 'expo-router';

import { getDb } from '@/core/storage';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { PRACTICE_KINDS, practiceId, type PracticeKind } from '@/features/practice/build';
import { loadPracticeSession } from '@/features/practice/load';
import { useProgress } from '@/features/progress/store';
import { useLoad } from '@/lib/useLoad';
import { LoadFailed } from '@/ui/components/LoadFailed';

export default function PracticeRoute() {
  const params = useLocalSearchParams<{ kind: string; ref?: string; title?: string }>();
  const kind = (PRACTICE_KINDS as readonly string[]).includes(params.kind)
    ? (params.kind as PracticeKind)
    : null;
  const spec = kind ? { kind, ref: params.ref || undefined } : null;
  const loaded = useLoad(
    async () =>
      spec
        ? loadPracticeSession(
            getDb(),
            spec,
            useProgress.getState().snapshot?.completedLessons ?? new Set<string>(),
            params.title ?? '',
          )
        : null,
    [kind ?? '', params.ref ?? '', params.title ?? ''],
  );

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/practice'));
  if (!spec) return <LessonScreen session={null} onExit={exit} />;
  if (loaded.status === 'failed') return <LoadFailed onRetry={loaded.retry} onExit={exit} />;
  if (loaded.status === 'loading') return null;

  return (
    <LessonScreen
      session={loaded.value}
      onComplete={(summary) =>
        useProgress
          .getState()
          .record(getDb(), { id: practiceId(spec), unitId: null, kind: 'practice' }, summary)
      }
      onExit={exit}
    />
  );
}

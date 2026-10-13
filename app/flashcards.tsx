import { useLocalSearchParams } from 'expo-router';

import { LEVELS, type Level } from '@/core/content/schema';
import { FlashcardsScreen } from '@/features/dictionary/FlashcardsScreen';
import type { DictStatus } from '@/features/dictionary/search';

const STATUSES: DictStatus[] = ['all', 'learning', 'known', 'favorites', 'mine'];

export default function FlashcardsRoute() {
  const p = useLocalSearchParams<{ status?: string; q?: string; levels?: string }>();
  const status = STATUSES.includes(p.status as DictStatus) ? (p.status as DictStatus) : 'all';
  const levels = (p.levels ?? '')
    .split(',')
    .filter((l): l is Level => (LEVELS as readonly string[]).includes(l));
  return <FlashcardsScreen status={status} query={p.q ?? ''} levels={levels} />;
}

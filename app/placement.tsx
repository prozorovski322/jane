import { router } from 'expo-router';

import { useOnboarding } from '@/features/onboarding/store';
import { PlacementRunner } from '@/features/placement/PlacementScreen';

/** Retaking the placement test from the profile. */
export default function PlacementRoute() {
  const self = useOnboarding((s) => s.data?.selfLevel) ?? 'unknown';
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  return (
    <PlacementRunner self={self === 'zero' ? 'basics' : self} onDone={leave} onCancel={leave} />
  );
}

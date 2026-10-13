import { useLocalSearchParams } from 'expo-router';

import { CertificateScreen } from '@/features/certificates/CertificateScreen';

export default function CertificateRoute() {
  const { level } = useLocalSearchParams<{ level: string }>();
  return <CertificateScreen level={level} />;
}

import { Link } from 'expo-router';
import { useState } from 'react';

import { PROVIDER_LABEL, type OAuthProvider } from '@/core/account/config';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { SwitchRow } from '@/ui/components/SettingRows';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { AuthPage } from './AuthPage';
import { AccountError, signInWith } from './service';

/** OAuth may also create an account, so consent is required before either entry point. */
export function OAuthConsentScreen({
  provider,
  onBack,
}: {
  provider: OAuthProvider;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proceed = async () => {
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWith(provider);
    } catch (e) {
      setError(
        e instanceof AccountError ? e.message : 'Не удалось начать вход. Попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthPage title={PROVIDER_LABEL[provider]}>
      <AppText variant="body">
        Вы перейдёте на страницу выбранного сервиса. После подтверждения Jane получит имя и почту.
        Если аккаунта Jane ещё нет, он будет создан.
      </AppText>
      <SwitchRow
        label="Согласен(на) на обработку персональных данных"
        description="Имя, почта и прогресс будут храниться в аккаунте Jane для входа, синхронизации и рейтинга."
        value={consent}
        onChange={setConsent}
      />
      <Link href="/privacy" style={{ color: colors.primary }}>
        <AppText variant="small" color="primary">
          Политика конфиденциальности
        </AppText>
      </Link>
      {error && (
        <AppText variant="small" color="error" aria-live="polite">
          {error}
        </AppText>
      )}
      <Button
        label="Продолжить"
        loading={busy}
        disabled={!consent || busy}
        onPress={() => void proceed()}
      />
      <Button label="Вернуться ко входу" variant="ghost" disabled={busy} onPress={onBack} />
    </AuthPage>
  );
}

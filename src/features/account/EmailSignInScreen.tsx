import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { TextField } from '@/ui/components/TextField';

import { AuthPage } from './AuthPage';
import { AccountError, sendEmailSignIn, verifyEmailCode, verifyEmailLink } from './service';

const errorMessage = (e: unknown) =>
  e instanceof AccountError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.';

/** One e-mail offers a code for this screen and a link that also works on another device. */
export function EmailSignInScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (!resendAt) return;
    const interval = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= resendAt) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendAt]);

  const send = async () => {
    if (busy || Date.now() < resendAt) return;
    const address = sentTo ?? email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError('Введите адрес почты.');
    setBusy(true);
    setError(null);
    try {
      await sendEmailSignIn(address);
      setSentTo(address);
      setCode('');
      const time = Date.now();
      setNow(time);
      setResendAt(time + 60_000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy || !sentTo) return;
    // Supabase allows a configurable code length. Do not hard-code six digits.
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Введите код из письма целиком.');
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(sentTo, code);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage title="Вход без пароля">
      {sentTo ? (
        <>
          <AppText variant="body" aria-live="polite">
            Если аккаунт {sentTo} зарегистрирован, на эту почту придёт письмо. Введите код из письма
            или нажмите в нём «Войти в Jane». Проверьте также папку «Спам».
          </AppText>
          <TextField
            label="Код из письма"
            placeholder="Код из письма"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            editable={!busy}
            onSubmitEditing={() => void verify()}
          />
          <Button
            label="Войти по коду"
            loading={busy}
            disabled={busy}
            onPress={() => void verify()}
          />
          <Button
            label={
              secondsLeft ? `Отправить снова через ${secondsLeft} с` : 'Отправить письмо снова'
            }
            variant="secondary"
            disabled={busy || secondsLeft > 0}
            onPress={() => void send()}
          />
          <Button
            label="Изменить почту"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
          />
        </>
      ) : (
        <>
          <AppText variant="body">
            Укажите почту своего аккаунта Jane. Пришлём одноразовый код и ссылку для входа. Если
            аккаунта ещё нет, сначала зарегистрируйтесь.
          </AppText>
          <TextField
            label="Почта"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
            onSubmitEditing={() => void send()}
          />
          <Button
            label={secondsLeft ? `Отправить снова через ${secondsLeft} с` : 'Прислать код и ссылку'}
            loading={busy}
            disabled={busy || secondsLeft > 0}
            onPress={() => void send()}
          />
        </>
      )}
      {error && (
        <AppText variant="small" color="error" aria-live="polite">
          {error}
        </AppText>
      )}
      <Button label="Вернуться ко входу" variant="ghost" disabled={busy} onPress={onBack} />
    </AuthPage>
  );
}

export function EmailLinkScreen({ tokenHash }: { tokenHash: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailLink(tokenHash);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthPage title="Подтверждение входа">
      <AppText variant="body">
        Нажмите «Войти в Jane», если вы запросили письмо для входа в свой аккаунт.
      </AppText>
      {error && (
        <AppText variant="small" color="error" aria-live="polite">
          {error}
        </AppText>
      )}
      <Button label="Войти в Jane" loading={busy} disabled={busy} onPress={() => void confirm()} />
      <Button
        label="Вернуться ко входу"
        variant="ghost"
        disabled={busy}
        onPress={() => router.replace('/auth')}
      />
    </AuthPage>
  );
}

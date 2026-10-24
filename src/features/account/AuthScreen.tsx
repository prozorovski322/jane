/**
 * Sign-in and sign-up. E-mail with a password, or one button for Google or Yandex ID
 * (whichever are configured). Sign-up asks for a name and for consent to the privacy policy.
 */
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  emailPasswordlessEnabled,
  oauthProviders,
  PROVIDER_LABEL,
  type OAuthProvider,
} from '@/core/account/config';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Mascot } from '@/ui/components/Mascot';
import { SwitchRow } from '@/ui/components/SettingRows';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { EmailLinkScreen, EmailSignInScreen } from './EmailSignInScreen';
import { OAuthConsentScreen } from './OAuthConsentScreen';

import { AccountError, MIN_PASSWORD, sendPasswordReset, signIn, signUp } from './service';

type Mode = 'signin' | 'signup' | 'reset';

const TITLE: Record<Mode, string> = {
  signin: 'Вход',
  signup: 'Регистрация',
  reset: 'Новый пароль',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with the form, or null when it can be sent. */
export function formProblem(
  mode: Mode,
  f: { email: string; password: string; name: string; consent: boolean },
): string | null {
  if (!EMAIL.test(f.email.trim())) return 'Введите адрес почты.';
  if (mode === 'reset') return null;
  if (f.password.length < (mode === 'signup' ? MIN_PASSWORD : 1))
    return mode === 'signup' ? `Пароль — не меньше ${MIN_PASSWORD} символов.` : 'Введите пароль.';
  if (mode === 'signup') {
    if (f.name.trim().length < 2) return 'Как вас называть? Нужно хотя бы 2 буквы.';
    if (!f.consent) return 'Нужно согласие с политикой конфиденциальности.';
  }
  return null;
}

export function AuthScreen() {
  const { token_hash: tokenHash } = useLocalSearchParams<{ token_hash?: string | string[] }>();
  if (tokenHash !== undefined)
    return <EmailLinkScreen tokenHash={typeof tokenHash === 'string' ? tokenHash : ''} />;
  return <PasswordAuthScreen />;
}

function PasswordAuthScreen() {
  const { colors, space } = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [tried, setTried] = useState(false);
  const [emailOnly, setEmailOnly] = useState(false);
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const providers = oauthProviders();

  const problem = formProblem(mode, { email, password, name, consent });

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const done = await fn();
      if (done) setMessage({ text: done, error: false });
    } catch (e) {
      setMessage({
        text: e instanceof AccountError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setTried(true);
    if (problem) return;
    void run(async () => {
      if (mode === 'signin') return signIn(email, password);
      if (mode === 'reset') {
        await sendPasswordReset(email);
        return 'Если такая почта зарегистрирована, на неё пришло письмо со ссылкой для нового пароля.';
      }
      const needsConfirm = await signUp(email, password, name);
      if (needsConfirm)
        return 'Почти готово: откройте письмо от Jane и нажмите на ссылку, чтобы подтвердить почту.';
    });
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setTried(false);
    setMessage(null);
  };

  if (emailOnly) return <EmailSignInScreen onBack={() => setEmailOnly(false)} />;
  if (provider) return <OAuthConsentScreen provider={provider} onBack={() => setProvider(null)} />;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { padding: space.lg, gap: space.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Mascot size={72} />
            <AppText variant="display">Jane</AppText>
            <AppText variant="body" color="textMuted" align="center">
              Английский с нуля до C1. Войдите, чтобы прогресс сохранялся в аккаунте и был на всех
              ваших устройствах.
            </AppText>
          </View>

          <AppText variant="title" role="heading">
            {TITLE[mode]}
          </AppText>

          {mode !== 'reset' && providers.length > 0 && (
            <View style={{ gap: space.sm }}>
              {providers.map((p) => (
                <Button
                  key={p}
                  label={PROVIDER_LABEL[p]}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setProvider(p)}
                />
              ))}
              <AppText variant="small" color="textMuted" align="center">
                или по почте
              </AppText>
            </View>
          )}

          {mode === 'signup' && (
            <TextField
              label="Как вас называть"
              placeholder="Имя"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              maxLength={30}
            />
          )}
          <TextField
            label="Почта"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={submit}
          />
          {mode !== 'reset' && (
            <TextField
              label="Пароль"
              placeholder={mode === 'signup' ? `Не меньше ${MIN_PASSWORD} символов` : 'Пароль'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              onSubmitEditing={submit}
            />
          )}
          {mode === 'signup' && (
            <View style={{ gap: space.xs }}>
              <SwitchRow
                label="Согласен(на) на обработку персональных данных"
                description="Почта, имя и прогресс хранятся в аккаунте, чтобы работали вход, синхронизация и рейтинг."
                value={consent}
                onChange={setConsent}
              />
              <Link href="/privacy" style={{ color: colors.primary }}>
                <AppText variant="small" color="primary">
                  Политика конфиденциальности
                </AppText>
              </Link>
            </View>
          )}

          {tried && problem && (
            <AppText variant="small" color="error" aria-live="polite">
              {problem}
            </AppText>
          )}
          {message && (
            <AppText variant="small" color={message.error ? 'error' : 'success'} aria-live="polite">
              {message.text}
            </AppText>
          )}

          <Button
            label={
              mode === 'signin'
                ? 'Войти'
                : mode === 'signup'
                  ? 'Зарегистрироваться'
                  : 'Прислать ссылку'
            }
            loading={busy}
            disabled={busy}
            onPress={submit}
          />

          <View style={{ gap: space.xs }}>
            {mode !== 'signin' && (
              <Button
                label="У меня есть аккаунт — войти"
                variant="ghost"
                onPress={() => switchTo('signin')}
              />
            )}
            {mode !== 'signup' && (
              <Button label="Создать аккаунт" variant="ghost" onPress={() => switchTo('signup')} />
            )}
            {mode === 'signin' && (
              <>
                {emailPasswordlessEnabled() && (
                  <Button
                    label="Войти по коду или ссылке на почту"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setEmailOnly(true)}
                  />
                )}
                <Button label="Забыли пароль?" variant="ghost" onPress={() => switchTo('reset')} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingBottom: 48 },
  brand: { alignItems: 'center', gap: 8, paddingVertical: 8 },
});

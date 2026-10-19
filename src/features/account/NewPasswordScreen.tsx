/** Setting a new password after following the link from the password-reset e-mail. */
import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { SettingGroup } from '@/ui/components/SettingRows';
import { SubScreen } from '@/ui/components/SubScreen';
import { TextField } from '@/ui/components/TextField';

import { AccountError, MIN_PASSWORD, setNewPassword } from './service';
import { useAccount } from './store';

export function NewPasswordScreen() {
  const signedIn = useAccount((s) => s.status === 'signed-in');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem =
    password.length < MIN_PASSWORD
      ? `Пароль — не меньше ${MIN_PASSWORD} символов.`
      : password !== repeat
        ? 'Пароли не совпадают.'
        : null;

  const save = async () => {
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(password);
      useAccount.getState().setRecovering(false);
      router.replace('/');
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SubScreen title="Новый пароль">
      <Card>
        <SettingGroup>
          {!signedIn ? (
            <AppText variant="body">
              Ссылка устарела или уже использована. Запросите новую на экране входа.
            </AppText>
          ) : (
            <>
              <TextField
                label="Новый пароль"
                placeholder={`Не меньше ${MIN_PASSWORD} символов`}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TextField
                label="Повторите пароль"
                value={repeat}
                onChangeText={setRepeat}
                secureTextEntry
                autoComplete="new-password"
                onSubmitEditing={() => void save()}
              />
              {error && (
                <AppText variant="small" color="error" aria-live="polite">
                  {error}
                </AppText>
              )}
              <Button
                label="Сохранить пароль"
                loading={busy}
                disabled={busy}
                onPress={() => void save()}
              />
            </>
          )}
        </SettingGroup>
      </Card>
    </SubScreen>
  );
}

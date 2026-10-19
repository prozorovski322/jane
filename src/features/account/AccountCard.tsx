/** The account in the profile: name, e-mail, sync state, friends, signing out, deleting. */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card, ListRow } from '@/ui/components/Card';
import { SettingGroup } from '@/ui/components/SettingRows';
import { TextField } from '@/ui/components/TextField';

import { AccountError, deleteAccount, renameProfile, signOut } from './service';
import { useAccount } from './store';

function syncLine(syncing: boolean, error: boolean, at: number | null): string {
  if (syncing) return 'Синхронизирую…';
  if (error) return 'Не удалось синхронизировать: нет связи. Попробую позже.';
  if (!at) return 'Ещё не синхронизировано.';
  const time = new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `Прогресс сохранён в аккаунте в ${time}.`;
}

export function AccountCard() {
  const { status, email, profile, userId, syncing, syncError, lastSyncedAt } = useAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status !== 'signed-in' || !userId) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof AccountError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SettingGroup>
        <View>
          <AppText variant="heading">{profile?.display_name ?? 'Аккаунт'}</AppText>
          <AppText variant="small" color="textMuted">
            {email}
          </AppText>
        </View>
        <AppText variant="small" color="textMuted" aria-live="polite">
          {syncLine(syncing, syncError, lastSyncedAt)}
        </AppText>

        <ListRow
          icon="trophy"
          title="Друзья и рейтинг недели"
          subtitle={profile ? `Ваш код для друзей: ${profile.friend_code}` : undefined}
          onPress={() => router.push('/leaderboard')}
        />

        {editing ? (
          <View style={{ gap: 8 }}>
            <TextField
              label="Имя"
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoCapitalize="words"
            />
            <Button
              label="Сохранить имя"
              compact
              disabled={busy || name.trim().length < 2}
              onPress={() =>
                void run(async () => {
                  await renameProfile(userId, name);
                  await useAccount.getState().refreshProfile();
                  setEditing(false);
                })
              }
            />
            <Button label="Отмена" variant="ghost" compact onPress={() => setEditing(false)} />
          </View>
        ) : (
          <Button
            label="Изменить имя"
            variant="secondary"
            compact
            onPress={() => {
              setName(profile?.display_name ?? '');
              setEditing(true);
            }}
          />
        )}

        <Button
          label="Синхронизировать сейчас"
          icon="refresh"
          variant="secondary"
          compact
          disabled={syncing}
          onPress={() => void useAccount.getState().sync()}
        />
        <Button
          label="Выйти из аккаунта"
          variant="ghost"
          compact
          disabled={busy}
          onPress={() => void run(signOut)}
        />
        {confirmDelete ? (
          <View style={{ gap: 8 }}>
            <AppText variant="small" aria-live="polite">
              Аккаунт, прогресс в нём, друзья и место в рейтинге будут удалены без возможности
              вернуть. Прогресс на этом устройстве останется.
            </AppText>
            <Button
              label="Да, удалить аккаунт"
              variant="danger"
              compact
              disabled={busy}
              onPress={() => void run(deleteAccount)}
            />
            <Button
              label="Отмена"
              variant="ghost"
              compact
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        ) : (
          <Button
            label="Удалить аккаунт"
            icon="trash"
            variant="ghost"
            compact
            onPress={() => setConfirmDelete(true)}
          />
        )}
        {message && (
          <AppText variant="small" color="error" aria-live="polite">
            {message}
          </AppText>
        )}
      </SettingGroup>
    </Card>
  );
}

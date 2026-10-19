/** This week's XP among friends and among everyone; adding friends by their code. */
import { useState } from 'react';
import { View } from 'react-native';

import { useLoad } from '@/lib/useLoad';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { ChipRow, SettingGroup } from '@/ui/components/SettingRows';
import { SubScreen } from '@/ui/components/SubScreen';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme/ThemeProvider';

import {
  AccountError,
  addFriend,
  friendsLeaderboard,
  globalLeaderboard,
  removeFriend,
  type LeaderRow,
} from './service';
import { useAccount } from './store';

type Board = 'friends' | 'all';

function Rows({ rows, onRemove }: { rows: LeaderRow[]; onRemove?: (row: LeaderRow) => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <View role="list" style={{ gap: space.xs }}>
      {rows.map((r, i) => (
        <View
          key={r.user_id ?? `${i}:${r.display_name}`}
          role="listitem"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            padding: space.sm,
            borderRadius: radius.md,
            backgroundColor: r.is_me ? colors.primarySoft : 'transparent',
          }}
        >
          <AppText variant="bodyStrong" style={{ width: 28 }}>
            {i + 1}
          </AppText>
          <AppText variant="body" style={{ flex: 1 }}>
            {r.display_name}
            {r.is_me ? ' (вы)' : ''}
          </AppText>
          <AppText variant="bodyStrong" color="xp">
            {r.week_xp} XP
          </AppText>
          {onRemove && !r.is_me && (
            <Button label="Убрать" variant="ghost" compact onPress={() => onRemove(r)} />
          )}
        </View>
      ))}
    </View>
  );
}

export function LeaderboardScreen() {
  const profile = useAccount((s) => s.profile);
  const [board, setBoard] = useState<Board>('friends');
  const [version, setVersion] = useState(0);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const loaded = useLoad(
    () => (board === 'friends' ? friendsLeaderboard() : globalLeaderboard()),
    [board, version],
  );

  const add = async () => {
    setMessage(null);
    try {
      const name = await addFriend(code);
      if (name) {
        setMessage({ text: `${name} теперь в ваших друзьях.`, error: false });
        setCode('');
        setVersion((v) => v + 1);
      } else setMessage({ text: 'Такого кода нет. Проверьте его у друга.', error: true });
    } catch (e) {
      setMessage({ text: e instanceof AccountError ? e.message : 'Не получилось.', error: true });
    }
  };

  return (
    <SubScreen title="Рейтинг недели">
      <ChipRow
        label="Кто в рейтинге"
        options={[
          { value: 'friends', label: 'Друзья' },
          { value: 'all', label: 'Все' },
        ]}
        value={board}
        onChange={setBoard}
      />
      <AppText variant="small" color="textMuted">
        Очки опыта с понедельника. Рейтинг обновляется после каждого урока.
      </AppText>
      <Card>
        {loaded.status === 'loading' && <AppText variant="body">Загружаю…</AppText>}
        {loaded.status === 'failed' && (
          <SettingGroup>
            <AppText variant="body">Не удалось загрузить рейтинг. Проверьте подключение.</AppText>
            <Button label="Попробовать ещё раз" compact onPress={loaded.retry} />
          </SettingGroup>
        )}
        {loaded.status === 'done' &&
          (loaded.value.length === 0 ? (
            <AppText variant="body" color="textMuted">
              {board === 'all'
                ? 'На этой неделе ещё никто не занимался. Станьте первым!'
                : 'Пока никого. Добавьте друзей по коду ниже.'}
            </AppText>
          ) : (
            <Rows
              rows={loaded.value}
              onRemove={
                board === 'friends'
                  ? (r) =>
                      r.user_id && void removeFriend(r.user_id).then(() => setVersion((v) => v + 1))
                  : undefined
              }
            />
          ))}
      </Card>

      <Card>
        <SettingGroup>
          <AppText variant="heading">Друзья</AppText>
          {profile && (
            <AppText variant="body">
              Ваш код: <AppText variant="bodyStrong">{profile.friend_code}</AppText>. Отправьте его
              другу, чтобы он добавил вас.
            </AppText>
          )}
          <TextField
            label="Код друга"
            placeholder="Например, 3F9A1C2B"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
            onSubmitEditing={() => void add()}
          />
          <Button
            label="Добавить друга"
            compact
            disabled={code.trim().length < 8}
            onPress={() => void add()}
          />
          {message && (
            <AppText variant="small" color={message.error ? 'error' : 'success'} aria-live="polite">
              {message.text}
            </AppText>
          )}
        </SettingGroup>
      </Card>
    </SubScreen>
  );
}

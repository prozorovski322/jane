import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { clearAiKey } from '@/core/checker/ai-key';
import { canStoreCourse, storeWholeCourse, type OfflineProgress } from '@/core/offline';
import { IS_WEB } from '@/core/platform';
import { syncReminders } from '@/core/notifications/reminders';
import { requestNotifications } from '@/core/permissions';
import { tts } from '@/core/speech/tts';
import { getDb } from '@/core/storage';
import {
  BackupError,
  exportSnapshot,
  importSnapshot,
  parseSnapshot,
  wipeData,
  type Snapshot,
} from '@/core/storage/backup';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card, ListRow } from '@/ui/components/Card';
import { SectionTitle } from '@/ui/components/Screen';
import { ChipRow, SettingGroup, SwitchRow } from '@/ui/components/SettingRows';
import { SubScreen } from '@/ui/components/SubScreen';
import { FONT_SCALES, type SchemePreference } from '@/ui/theme/ThemeProvider';

import {
  DEFAULT_REMINDER,
  REMINDER_KEY,
  useOnboarding,
  type ReminderPrefs,
} from '../onboarding/store';
import { MINUTE_OPTIONS } from '../progress/goal';
import { useProgress } from '../progress/store';
import { WEEKLY_GOAL_OPTIONS } from '@/core/progress/week';
import { pickJsonFile, saveJsonFile } from './files';
import { loadSettings, useSettings } from './store';
import { useKvState } from './useKvState';
import { listEnglishVoices, type VoiceOption } from './voices';

const REMINDER_HOURS = [7, 8, 9, 12, 18, 19, 20, 21];
const RATES = [
  { value: 0.7, label: 'Медленно' },
  { value: 0.9, label: 'Обычно' },
  { value: 1.1, label: 'Быстро' },
] as const;
const THEMES: { value: SchemePreference; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];
const DEFAULT_MINUTES = 10;

const pad = (n: number) => String(n).padStart(2, '0');

type Pending = { kind: 'import'; snap: Snapshot } | { kind: 'wipe' } | null;

/** Reloads everything that was read from the database after an import or a wipe. */
async function reloadAll() {
  const db = getDb();
  await loadSettings(db);
  await useOnboarding.getState().load(db);
  await useProgress.getState().refresh(db);
  void syncReminders(db);
}

function Reminders() {
  const [prefs, setPrefs] = useKvState<ReminderPrefs>(REMINDER_KEY, DEFAULT_REMINDER);
  const [note, setNote] = useState<string | null>(null);

  const save = async (next: ReminderPrefs) => {
    await setPrefs(next);
    await syncReminders(getDb());
  };

  const toggle = async (on: boolean) => {
    setNote(null);
    if (!on) return save({ ...prefs, enabled: false });
    const outcome = await requestNotifications();
    if (outcome === 'granted') return save({ ...prefs, enabled: true });
    setNote(
      outcome === 'denied'
        ? 'Уведомления запрещены в настройках телефона. Разрешите их для Jane, чтобы получать напоминания.'
        : 'На этом устройстве напоминания недоступны.',
    );
  };

  const hours = REMINDER_HOURS.includes(prefs.hour)
    ? REMINDER_HOURS
    : [...REMINDER_HOURS, prefs.hour].sort((a, b) => a - b);

  return (
    <Card>
      <SettingGroup>
        <SwitchRow
          label="Напоминать об уроках"
          description="Один раз в день, в удобное время. Если вы уже позанимались, напоминание не придёт."
          value={prefs.enabled}
          onChange={(on) => void toggle(on)}
        />
        {prefs.enabled && (
          <ChipRow
            label="Время"
            options={hours.map((h) => ({ value: h, label: `${h}:${pad(0)}` }))}
            value={prefs.hour}
            onChange={(hour) => void save({ ...prefs, hour, minute: 0 })}
          />
        )}
        {note && (
          <AppText variant="small" color="textMuted" aria-live="polite">
            {note}
          </AppText>
        )}
      </SettingGroup>
    </Card>
  );
}

function Voice() {
  const rate = useSettings((s) => s.speechRate);
  const voice = useSettings((s) => s.voice);
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    let alive = true;
    void listEnglishVoices().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  const options = [
    { value: '', label: 'Автоматически' },
    ...voices.map((v) => ({ value: v.id, label: v.name })),
  ];
  return (
    <Card>
      <SettingGroup>
        <ChipRow
          label="Скорость речи"
          options={RATES}
          value={RATES.find((r) => r.value === rate)?.value ?? 0.9}
          onChange={(speechRate) => useSettings.getState().update({ speechRate })}
        />
        {voices.length > 0 && (
          <ChipRow
            label="Голос"
            options={options}
            value={voice ?? ''}
            onChange={(v) => useSettings.getState().update({ voice: v || null })}
          />
        )}
        <Button
          label="Проверить звучание"
          icon="speaker"
          variant="secondary"
          compact
          onPress={() => void tts.speak('Hello! Nice to meet you.')}
        />
      </SettingGroup>
    </Card>
  );
}

function Data() {
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : 'Не получилось. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const snap = await exportSnapshot(getDb());
      const day = snap.exportedAt.slice(0, 10);
      const outcome = await saveJsonFile(`jane-${day}.json`, JSON.stringify(snap));
      setMessage(
        outcome === 'unavailable'
          ? 'На этом устройстве нельзя поделиться файлом.'
          : 'Копия готова. Храните файл у себя: в нём ваш прогресс.',
      );
    });

  const doPick = () =>
    run(async () => {
      const text = await pickJsonFile();
      if (text !== null) setPending({ kind: 'import', snap: parseSnapshot(text) });
    });

  const doImport = (snap: Snapshot) =>
    run(async () => {
      await importSnapshot(getDb(), snap);
      await reloadAll();
      setPending(null);
      setMessage('Прогресс загружен из копии.');
    });

  const doWipe = () =>
    run(async () => {
      await wipeData(getDb());
      await clearAiKey();
      await reloadAll();
      setPending(null);
      router.replace('/onboarding');
    });

  return (
    <Card>
      <SettingGroup>
        <AppText variant="small" color="textMuted">
          {IS_WEB
            ? 'Прогресс хранится только в этом браузере. Сохраните копию, чтобы перенести его на другое устройство или не потерять, если данные браузера будут очищены.'
            : 'Прогресс хранится только на этом устройстве. Сохраните копию, чтобы перенести его на другой телефон или не потерять при переустановке.'}
        </AppText>
        <Button
          label="Сохранить копию прогресса"
          icon="arrow-right"
          variant="secondary"
          compact
          disabled={busy}
          onPress={() => void doExport()}
        />
        <Button
          label="Загрузить копию из файла"
          icon="plus"
          variant="secondary"
          compact
          disabled={busy}
          onPress={() => void doPick()}
        />
        {pending?.kind === 'import' && (
          <View style={{ gap: 8 }}>
            <AppText variant="small" aria-live="polite">
              Копия от {pending.snap.exportedAt.slice(0, 10)}. Текущий прогресс на этом устройстве
              будет заменён.
            </AppText>
            <Button
              label="Заменить прогресс копией"
              variant="danger"
              compact
              disabled={busy}
              onPress={() => void doImport(pending.snap)}
            />
            <Button label="Отмена" variant="ghost" compact onPress={() => setPending(null)} />
          </View>
        )}
        <Button
          label="Удалить все данные"
          icon="trash"
          variant="ghost"
          compact
          disabled={busy}
          onPress={() => setPending({ kind: 'wipe' })}
        />
        {pending?.kind === 'wipe' && (
          <View style={{ gap: 8 }}>
            <AppText variant="small" aria-live="polite">
              Весь прогресс, слова и настройки будут стёрты без возможности вернуть. Сначала
              сохраните копию, если она может понадобиться.
            </AppText>
            <Button
              label="Да, удалить всё"
              variant="danger"
              compact
              disabled={busy}
              onPress={() => void doWipe()}
            />
            <Button label="Отмена" variant="ghost" compact onPress={() => setPending(null)} />
          </View>
        )}
        {message && (
          <AppText variant="small" aria-live="polite">
            {message}
          </AppText>
        )}
      </SettingGroup>
    </Card>
  );
}

/** Website only: download every unit now, so the whole course works without a connection. */
function OfflineCourse() {
  const [progress, setProgress] = useState<OfflineProgress | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const available = canStoreCourse();
  const start = async () => {
    setState('busy');
    try {
      const result = await storeWholeCourse(setProgress);
      setState(result.failed ? 'failed' : 'done');
    } catch {
      setState('failed');
    }
  };
  return (
    <Card>
      <SettingGroup>
        <AppText variant="small" color="textMuted">
          Сайт уже работает без интернета, но уроки сохраняются по мере того, как вы их открываете.
          Можно сохранить весь курс сразу — это около 4 МБ.
        </AppText>
        <Button
          label={state === 'done' ? 'Весь курс сохранён' : 'Сохранить весь курс'}
          icon={state === 'done' ? 'check' : 'arrow-right'}
          variant="secondary"
          compact
          disabled={!available || state === 'busy' || state === 'done'}
          loading={state === 'busy'}
          onPress={() => void start()}
        />
        {!available && (
          <AppText variant="small" color="textMuted">
            Станет доступно после перезагрузки страницы.
          </AppText>
        )}
        {state === 'busy' && progress && (
          <AppText variant="small" aria-live="polite">
            Сохранено {progress.done} из {progress.total} юнитов…
          </AppText>
        )}
        {state === 'failed' && (
          <AppText variant="small" aria-live="polite">
            Часть юнитов не скачалась
            {progress?.failed ? ` (${progress.failed})` : ''}. Проверьте подключение и попробуйте
            ещё раз.
          </AppText>
        )}
      </SettingGroup>
    </Card>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const [minutes, setMinutes] = useKvState<number>('goal.dailyMinutes', DEFAULT_MINUTES);
  const update = s.update;

  const chooseMinutes = async (m: number) => {
    await setMinutes(m);
    await useProgress.getState().refresh(getDb());
  };

  return (
    <SubScreen title="Настройки" fallback="/">
      <SectionTitle>Цель</SectionTitle>
      <Card>
        <SettingGroup>
          <ChipRow
            label="Время в день"
            description="От этого зависят цель дня и план «Сегодня»."
            options={MINUTE_OPTIONS.map((m) => ({ value: m as number, label: `${m} мин` }))}
            value={minutes}
            onChange={(m) => void chooseMinutes(m)}
          />
          <ChipRow
            label="Дней в неделю"
            description="Цель недели: сколько дней вы хотите заниматься."
            options={WEEKLY_GOAL_OPTIONS.map((d) => ({ value: d as number, label: String(d) }))}
            value={s.weeklyGoalDays}
            onChange={(weeklyGoalDays) => update({ weeklyGoalDays })}
          />
        </SettingGroup>
      </Card>

      {!IS_WEB && (
        <>
          <SectionTitle>Напоминания</SectionTitle>
          <Reminders />
        </>
      )}

      <SectionTitle>Озвучка</SectionTitle>
      <Voice />

      <SectionTitle>Внешний вид</SectionTitle>
      <Card>
        <SettingGroup>
          <ChipRow
            label="Тема"
            options={THEMES}
            value={s.theme}
            onChange={(theme) => update({ theme })}
          />
          <ChipRow
            label="Размер текста"
            description="Добавляется к размеру шрифта, выбранному в системе."
            options={FONT_SCALES}
            value={s.fontScale}
            onChange={(fontScale) => update({ fontScale })}
          />
        </SettingGroup>
      </Card>

      <SectionTitle>Отклик</SectionTitle>
      <Card>
        <SettingGroup>
          {!IS_WEB && (
            <SwitchRow
              label="Вибрация"
              value={s.haptics}
              onChange={(haptics) => update({ haptics })}
            />
          )}
          <SwitchRow label="Звуки" value={s.sounds} onChange={(sounds) => update({ sounds })} />
        </SettingGroup>
      </Card>

      <SectionTitle>Речь и письмо</SectionTitle>
      <Card>
        <SettingGroup>
          <SwitchRow
            label={IS_WEB ? 'Распознавание речи в браузере' : 'Распознавание через сервис системы'}
            description={
              IS_WEB
                ? 'Браузер отправляет запись голоса на свой сервер: Chrome — в Google, Safari — в Apple, Edge — в Microsoft. Без этого ответы в заданиях на говорение вы проверяете сами. По умолчанию выключено.'
                : 'Только если на телефоне нет распознавания без интернета. Тогда звук обрабатывает Apple или Google. По умолчанию выключено.'
            }
            value={s.cloudSpeech}
            onChange={(cloudSpeech) => update({ cloudSpeech })}
          />
        </SettingGroup>
      </Card>
      <ListRow
        icon="star"
        title="Проверка письма нейросетью"
        subtitle="Необязательно: свой ключ API, выключено по умолчанию"
        onPress={() => router.push('/ai-review')}
      />

      <SectionTitle>Данные</SectionTitle>
      <Data />
      {IS_WEB && (
        <>
          <SectionTitle>Без интернета</SectionTitle>
          <OfflineCourse />
        </>
      )}

      <SectionTitle>О приложении</SectionTitle>
      <ListRow
        icon="book"
        title="Конфиденциальность"
        subtitle="Что хранится и что никуда не отправляется"
        onPress={() => router.push('/privacy')}
      />
      <AppText variant="caption" color="textMuted" align="center">
        Jane {Constants.expoConfig?.version ?? ''}
      </AppText>
    </SubScreen>
  );
}

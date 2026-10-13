import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { requestNotifications } from '@/core/permissions';
import { syncReminders } from '@/core/notifications/reminders';
import { setDb } from '@/core/storage';
import type { Db } from '@/core/storage/db';
import { kvGet } from '@/core/storage/kv';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import { scaleTypography } from '@/ui/theme/ThemeProvider';
import { typography } from '@/ui/theme/tokens';

import { useOnboarding } from '../../onboarding/store';
import { recordSession } from '../../progress/service';
import { pickJsonFile, saveJsonFile } from '../files';
import { PRIVACY_SECTIONS } from '../privacy';
import { SettingsScreen } from '../SettingsScreen';
import { DEFAULT_SETTINGS, bindSettings, useSettings } from '../store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('@/core/permissions', () => ({ requestNotifications: jest.fn() }));
jest.mock('@/core/notifications/reminders', () => ({
  syncReminders: jest.fn(async () => 0),
  configureNotifications: jest.fn(),
}));
jest.mock('../files', () => ({ saveJsonFile: jest.fn(), pickJsonFile: jest.fn() }));
jest.mock('../voices', () => ({ listEnglishVoices: jest.fn(async () => []) }));
jest.mock('@/core/checker/ai-key', () => ({ clearAiKey: jest.fn(async () => {}) }));

const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;

let db: Db;
let unbind: () => void;

beforeEach(async () => {
  jest.clearAllMocks();
  db = openNodeDb();
  await migrate(db);
  setDb(db);
  useSettings.setState(DEFAULT_SETTINGS);
  unbind = await bindSettings(db);
  await useOnboarding.getState().load(db);
});
afterEach(async () => {
  unbind();
  setDb(null);
  await db.close();
});

const press = (name: string | RegExp) =>
  userEvent.setup().press(screen.getByRole('button', { name }));

describe('Settings', () => {
  it('changes the theme and the text size, and saves them', async () => {
    await render(<SettingsScreen />);
    await press('Тёмная');
    await press('Крупный');
    expect(useSettings.getState().theme).toBe('dark');
    expect(useSettings.getState().fontScale).toBe(1.15);
    await waitFor(async () =>
      expect(await kvGet<{ theme: string }>(db, 'settings', { theme: '' })).toMatchObject({
        theme: 'dark',
      }),
    );
  });

  it('switches haptics, sounds and cloud recognition (off by default)', async () => {
    await render(<SettingsScreen />);
    expect(useSettings.getState().cloudSpeech).toBe(false);
    await fireEvent(screen.getByRole('switch', { name: 'Звуки' }), 'valueChange', false);
    expect(useSettings.getState().sounds).toBe(false);
    await fireEvent(
      screen.getByRole('switch', { name: 'Распознавание через сервис системы' }),
      'valueChange',
      true,
    );
    expect(useSettings.getState().cloudSpeech).toBe(true);
  });

  it('turns reminders on only after the permission is granted', async () => {
    jest.mocked(requestNotifications).mockResolvedValueOnce('denied');
    await render(<SettingsScreen />);
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Напоминать об уроках' })).toBeOnTheScreen(),
    );
    await fireEvent(
      screen.getByRole('switch', { name: 'Напоминать об уроках' }),
      'valueChange',
      true,
    );
    await screen.findByText(/Уведомления запрещены/);
    expect(await kvGet<{ enabled: boolean }>(db, 'reminders', { enabled: false })).toMatchObject({
      enabled: false,
    });

    jest.mocked(requestNotifications).mockResolvedValueOnce('granted');
    await fireEvent(
      screen.getByRole('switch', { name: 'Напоминать об уроках' }),
      'valueChange',
      true,
    );
    await screen.findByRole('button', { name: '19:00' });
    expect(await kvGet<{ enabled: boolean }>(db, 'reminders', { enabled: false })).toMatchObject({
      enabled: true,
    });
    expect(syncReminders).toHaveBeenCalled();

    await press('8:00');
    await waitFor(async () =>
      expect(await kvGet<{ hour: number }>(db, 'reminders', { hour: 0 })).toMatchObject({
        hour: 8,
      }),
    );
  });

  it('changes the daily goal', async () => {
    await render(<SettingsScreen />);
    await screen.findByRole('button', { name: '30 мин' });
    await press('30 мин');
    await waitFor(async () => expect(await kvGet<number>(db, 'goal.dailyMinutes', 0)).toBe(30));
  });

  it('exports a backup file', async () => {
    jest.mocked(saveJsonFile).mockResolvedValue('shared');
    await render(<SettingsScreen />);
    await press('Сохранить копию прогресса');
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalled());
    const [name, text] = jest.mocked(saveJsonFile).mock.calls[0]!;
    expect(name).toMatch(/^jane-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text)).toMatchObject({ app: 'jane' });
    await screen.findByText(/Копия готова/);
  });

  it('asks before importing, and rejects files that are not backups', async () => {
    await render(<SettingsScreen />);
    jest.mocked(pickJsonFile).mockResolvedValueOnce('{"hello": 1}');
    await press('Загрузить копию из файла');
    await screen.findByText(/не похож на резервную копию/);

    // A real backup: progress is replaced only after the learner confirms.
    await recordSession(
      db,
      { id: 'a1.u01.l01', unitId: 'a1.u01', kind: 'lesson' },
      {
        lessonId: 'a1.u01.l01',
        total: 1,
        answered: 1,
        skipped: 0,
        correctFirstTry: 1,
        accuracy: 1,
        score: 1,
        durationMs: 1000,
        outcomes: [],
      },
    );
    jest.mocked(saveJsonFile).mockResolvedValue('shared');
    await press('Сохранить копию прогресса');
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalled());
    const backup = jest.mocked(saveJsonFile).mock.calls[0]![1];
    await db.run('DELETE FROM lesson_progress');

    jest.mocked(pickJsonFile).mockResolvedValueOnce(backup);
    await press('Загрузить копию из файла');
    await screen.findByText(/Текущий прогресс на этом устройстве будет заменён/);
    expect(await db.get('SELECT * FROM lesson_progress')).toBeFalsy();
    await press('Заменить прогресс копией');
    await screen.findByText('Прогресс загружен из копии.');
    expect(await db.get('SELECT * FROM lesson_progress')).toBeTruthy();
  });

  it('deletes everything only after a second confirmation', async () => {
    await db.run("INSERT INTO favorites (word_id, added_at) VALUES ('hello', 1)");
    await render(<SettingsScreen />);
    await press('Удалить все данные');
    expect(await db.get('SELECT * FROM favorites')).toBeTruthy();
    await press('Да, удалить всё');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'));
    expect(await db.get('SELECT * FROM favorites')).toBeFalsy();
    expect(useOnboarding.getState().data?.done).toBe(false);
  });

  it('opens the privacy policy and the AI review settings', async () => {
    await render(<SettingsScreen />);
    await press(/Конфиденциальность/);
    expect(mockRouter.push).toHaveBeenCalledWith('/privacy');
    await press(/Проверка письма нейросетью/);
    expect(mockRouter.push).toHaveBeenCalledWith('/ai-review');
  });
});

describe('text size', () => {
  it('scales font sizes and line heights together', () => {
    expect(scaleTypography(1)).toBe(typography);
    const big = scaleTypography(1.3);
    expect(big.body.fontSize).toBe(Math.round(typography.body.fontSize * 1.3));
    expect(big.body.lineHeight).toBeGreaterThan(big.body.fontSize);
    expect(big.body.fontFamily).toBe(typography.body.fontFamily);
  });
});

describe('privacy policy', () => {
  it('has the same sections in the app and in PRIVACY.md', () => {
    const md = readFileSync(join(__dirname, '../../../../PRIVACY.md'), 'utf8');
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    for (const s of PRIVACY_SECTIONS) expect(headings).toContain(s.title);
  });

  it('does not promise anything the app does not do', () => {
    const text = PRIVACY_SECTIONS.flatMap((s) => s.paragraphs).join(' ');
    expect(text).toMatch(/нет рекламы, трекеров и аналитики/);
    expect(text).toMatch(/не отправляется|никуда не отправляется/);
  });
});

import { render, screen, userEvent } from '@testing-library/react-native';

import { setDb } from '@/core/storage';
import type { Db } from '@/core/storage/db';
import { kvGet } from '@/core/storage/kv';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { placementHistory } from '../../placement/apply';
import { PlacementRunner } from '../../placement/PlacementScreen';
import { dailyMinutes } from '../../progress/service';
import { useProgress } from '../../progress/store';
import { OnboardingScreen } from '../OnboardingScreen';
import { useOnboarding } from '../store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('@/core/permissions', () => ({
  requestNotifications: jest.fn(async () => 'granted'),
  requestMicrophone: jest.fn(async () => 'denied'),
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;

let db: Db;
beforeEach(async () => {
  jest.clearAllMocks();
  db = openNodeDb();
  await migrate(db);
  setDb(db);
  await useOnboarding.getState().load(db);
  await useProgress.getState().refresh(db);
});
afterEach(async () => {
  setDb(null);
  await db.close();
});

const press = (name: string | RegExp) =>
  userEvent
    .setup()
    .press(screen.queryByRole('radio', { name }) ?? screen.getByRole('button', { name }));

describe('onboarding', () => {
  it('a complete beginner skips the test and finishes with the chosen settings', async () => {
    await render(<OnboardingScreen />);
    await press('Начать');
    await press('Путешествия');
    await press('Дальше');
    await press('Начинаю с нуля');
    await press('Дальше');
    await press('15 минут — уверенный темп');
    await press('Дальше');
    expect(screen.getByText('Начнём с самых основ')).toBeOnTheScreen();
    await press('Дальше');

    await press('Разрешить уведомления');
    expect(await screen.findByText('Разрешено')).toBeOnTheScreen();
    await press('Разрешить микрофон');
    expect(await screen.findByText(/Не разрешено/)).toBeOnTheScreen();
    await press('Готово');

    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(useOnboarding.getState().data).toMatchObject({
      done: true,
      goal: 'travel',
      selfLevel: 'zero',
    });
    expect(await dailyMinutes(db)).toBe(15);
    expect(await kvGet(db, 'reminders', null)).toMatchObject({ enabled: true });
  });

  it('cannot go on without choosing, and offers the test to others', async () => {
    await render(<OnboardingScreen />);
    await press('Начать');
    expect(screen.getByRole('button', { name: 'Дальше' })).toBeDisabled();
    await press('Работа и карьера');
    await press('Дальше');
    await press('Знаю основы');
    await press('Дальше');
    await press('Дальше');
    expect(screen.getByText('Тест уровня')).toBeOnTheScreen();
    await press('Пройти тест');
    expect(await screen.findByText(/Вопрос 1/)).toBeOnTheScreen();
  });
});

describe('placement test screen', () => {
  it('ends after 15 honest «Не знаю», shows the result and saves it', async () => {
    const onDone = jest.fn();
    await render(<PlacementRunner self="unknown" onDone={onDone} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Ответить' })).toBeDisabled();
    for (let i = 0; i < 15; i++) await press('Не знаю');

    expect(await screen.findByText('Начнём с нуля')).toBeOnTheScreen();
    expect(screen.getByText('Верных ответов: 0 из 15.')).toBeOnTheScreen();
    await press(/Разбор ошибок \(15\)/);
    expect(screen.getAllByText(/./).length).toBeGreaterThan(15);
    await press('Продолжить');
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ fromZero: true, answered: 15 }));
    expect(await placementHistory(db)).toHaveLength(1);
  });
});

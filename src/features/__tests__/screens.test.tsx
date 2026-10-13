import { render, screen, userEvent } from '@testing-library/react-native';

import { setDb } from '@/core/storage';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import { listUserWords } from '@/core/storage/words-repo';

import { AddWordScreen } from '../dictionary/AddWordScreen';
import { DictionaryScreen } from '../dictionary/DictionaryScreen';
import { GrammarNoteScreen } from '../grammar/GrammarScreens';
import { PathScreen } from '../path/PathScreen';
import { PracticeScreen } from '../practice/PracticeScreen';
import { recordSession } from '../progress/service';
import { useProgress } from '../progress/store';
import { TodayScreen } from '../today/TodayScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { LessonSummary } from '../lesson/components/LessonSummary';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;

let db: Db;

beforeEach(async () => {
  jest.clearAllMocks();
  db = openNodeDb();
  await migrate(db);
  setDb(db);
  await useProgress.getState().refresh(db);
});
afterEach(async () => {
  setDb(null);
  await db.close();
});

async function completeLesson(id: string) {
  await recordSession(
    db,
    { id, unitId: id.split('.').slice(0, 2).join('.'), kind: 'lesson' },
    {
      lessonId: id,
      total: 1,
      answered: 1,
      skipped: 0,
      correctFirstTry: 1,
      accuracy: 1,
      score: 1,
      durationMs: 60_000,
      outcomes: [
        {
          exerciseId: `${id}.e01`,
          correct: true,
          score: 1,
          usedHint: false,
          words: ['hello'],
          grammar: [],
          troubles: [],
          skill: 'vocabulary',
        },
      ],
    },
  );
  await useProgress.getState().refresh(db);
}

describe('Path', () => {
  it('points to the next unfinished lesson and marks done ones', async () => {
    await completeLesson('a1.u01.l01');
    await render(<PathScreen />);
    expect(screen.getByText('Я, ты, он: am, is, are', { exact: false })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /Урок 1: Привет и пока\. Слова, пройден/ }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Урок 2: .* следующий/ })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Начать' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/lesson/a1.u01.l02');
  });
});

describe('Today', () => {
  it('shows the plan and changes the daily goal', async () => {
    await render(<TodayScreen />);
    expect(await screen.findByText('План дня · 0 из 2')).toBeOnTheScreen();
    expect(screen.getByText('0 / 20 XP')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: '5 мин' }));
    expect(await screen.findByText('0 / 10 XP')).toBeOnTheScreen();
  });

  it('ticks a lesson done today', async () => {
    await render(<TodayScreen />);
    await screen.findByText('План дня · 0 из 2');
    await completeLesson('a1.u01.l01');
    expect(await screen.findByText('План дня · 1 из 2')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /Привет и пока\. Новый урок · 5 мин\. Сделано\./ }),
    ).toBeOnTheScreen();
  });
});

describe('Dictionary', () => {
  it('searches in Russian and filters by status', async () => {
    const user = userEvent.setup();
    await render(<DictionaryScreen />);
    expect(await screen.findByText('Найдено: 84')).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Поиск по словарю'), 'врач');
    expect(await screen.findByText('Найдено: 1')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^doctor — врач/ })).toBeOnTheScreen();
    await user.clear(screen.getByLabelText('Поиск по словарю'));
    await user.press(screen.getByRole('button', { name: 'Мои слова' }));
    expect(await screen.findByText(/Своих слов пока нет/)).toBeOnTheScreen();
  });
});

describe('Add word', () => {
  it('validates, saves and starts learning the word', async () => {
    const user = userEvent.setup();
    await render(<AddWordScreen />);
    await user.press(screen.getByRole('button', { name: 'Сохранить и учить' }));
    expect(screen.getByText('Напишите слово или фразу по-английски.')).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Слово или фраза'), 'deadline');
    await user.type(screen.getByLabelText('Перевод'), 'срок, крайний срок');
    await user.press(screen.getByRole('button', { name: 'Сохранить и учить' }));

    expect(mockRouter.replace).toHaveBeenCalledWith('/word/user-1');
    expect(await listUserWords(db)).toMatchObject([
      { en: 'deadline', ru: ['срок', 'крайний срок'] },
    ]);
    expect(useProgress.getState().dueCount).toBe(1);
  });

  it('warns about a word that is already in the course', async () => {
    const user = userEvent.setup();
    await render(<AddWordScreen />);
    await user.type(screen.getByLabelText('Слово или фраза'), 'Teacher');
    await user.type(screen.getByLabelText('Перевод'), 'учитель');
    await user.press(screen.getByRole('button', { name: 'Сохранить и учить' }));
    expect(await screen.findByText(/Это слово уже есть в курсе/)).toBeOnTheScreen();
    expect(await listUserWords(db)).toEqual([]);
  });
});

describe('Grammar reference', () => {
  it('renders a note with examples, tables and typical mistakes', async () => {
    await render(<GrammarNoteScreen id="a1.be-present" />);
    expect(screen.getByText('Глагол to be: am, is, are')).toBeOnTheScreen();
    expect(screen.getByText("you're, we're, they're")).toBeOnTheScreen();
    expect(screen.getByLabelText('Неправильно: I from Kazan.')).toBeOnTheScreen();
    expect(screen.getByLabelText("Правильно: I'm from Kazan.")).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Потренировать правило' }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ kind: 'grammar', ref: 'a1.be-present' }),
      }),
    );
  });
});

describe('Practice', () => {
  it('offers skill practice only after a lesson is done', async () => {
    await render(<PracticeScreen />);
    expect(await screen.findByText(/Пройдите первый урок/)).toBeOnTheScreen();
    await completeLesson('a1.u01.l05');
    expect(await screen.findByRole('button', { name: /Аудирование\. Диктанты/ })).toBeOnTheScreen();
  });
});

describe('Today: quests and weekly goal', () => {
  it('shows three optional quests and the weekly goal', async () => {
    await render(<TodayScreen />);
    expect(await screen.findByText('Задания дня')).toBeOnTheScreen();
    expect(screen.getByText('0 из 3')).toBeOnTheScreen();
    expect(screen.getByText(/Необязательно\. За все три/)).toBeOnTheScreen();
    expect(screen.getByText(/Неделя: 0 из 4 дней/)).toBeOnTheScreen();
  });

  it('counts a finished lesson in the weekly goal and the quests', async () => {
    await render(<TodayScreen />);
    await screen.findByText('Задания дня');
    await completeLesson('a1.u01.l01');
    expect(await screen.findByText(/Неделя: 1 из 4 дней/)).toBeOnTheScreen();
  });
});

describe('Profile: achievements and weekly summary', () => {
  it('lists achievements with progress and unlocks the first one after a lesson', async () => {
    await completeLesson('a1.u01.l01');
    await render(<ProfileScreen />);
    expect(await screen.findByText(/Получено \d+ из \d+/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Первый урок\. Получено\./)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Разгон\..*Прогресс: 1 из 5\./)).toBeOnTheScreen();
    expect(await screen.findByText('Эта неделя')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Дней с занятиями: 1$/)).toBeOnTheScreen();
  });

  it('opens the settings', async () => {
    await render(<ProfileScreen />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Настройки' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });
});

describe('Lesson summary: rewards', () => {
  const summary = {
    lessonId: 'a1.u01.l01',
    total: 5,
    answered: 5,
    skipped: 0,
    correctFirstTry: 5,
    accuracy: 1,
    score: 1,
    durationMs: 60_000,
    outcomes: [],
  };
  const info = {
    xp: 20,
    totalXp: 30,
    todayXp: 30,
    goalXp: 20,
    goalJustReached: true,
    streak: 1,
    streakExtended: true,
    freezes: 2,
    freezeEarned: false,
    passed: true,
    cardsUpdated: 0,
    certificate: null,
    bonusXp: 15,
    questsCompleted: ['Пройдите урок'],
    allQuestsDone: true,
    achievements: [{ id: 'first-lesson', title: 'Первый урок' }],
  };

  it('announces completed quests and new achievements', async () => {
    await render(
      <LessonSummary
        summary={summary}
        kind="lesson"
        save={{ status: 'saved', info }}
        onRetrySave={() => {}}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText(/Задание дня выполнено: Пройдите урок\./)).toBeOnTheScreen();
    expect(screen.getByText(/Все задания дня сделаны!/)).toBeOnTheScreen();
    expect(screen.getByText(/Бонус \+15 XP/)).toBeOnTheScreen();
    expect(screen.getByText('Новое достижение: Первый урок')).toBeOnTheScreen();
  });
});

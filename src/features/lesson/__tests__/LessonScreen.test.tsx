import { render, screen, userEvent } from '@testing-library/react-native';

import type { CompletionInfo } from '../../progress/service';
import type { LessonSummary } from '../engine';
import { LessonScreen } from '../LessonScreen';
import { sessionForLesson, type LessonSession } from '../session';

const press = (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  user.press(screen.getByRole('button', { name }));

const lesson1 = sessionForLesson('a1.u01.l01')!;

/** A one-exercise session: the picture exercise ("hello"). */
const tiny: LessonSession = { ...lesson1, exercises: lesson1.exercises.slice(0, 1) };

const info: CompletionInfo = {
  xp: 16,
  totalXp: 16,
  todayXp: 16,
  goalXp: 20,
  goalJustReached: false,
  streak: 1,
  streakExtended: true,
  freezes: 2,
  freezeEarned: false,
  passed: true,
  cardsUpdated: 1,
};

describe('LessonScreen', () => {
  it('checks an answer, explains it and moves on', async () => {
    const user = userEvent.setup();
    await render(<LessonScreen session={lesson1} onExit={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled();
    await press(user, 'good night');
    await press(user, 'Проверить');

    expect(await screen.findByText('Не совсем')).toBeOnTheScreen();
    // The correct answer is shown as a word ("hello", not a word id), next to the option itself.
    expect(screen.getByText('Правильный ответ:')).toBeOnTheScreen();
    expect(screen.getAllByText('hello')).toHaveLength(2);
    expect(screen.getByText('Это задание вернётся в конце урока.')).toBeOnTheScreen();

    await press(user, 'Дальше');
    expect(screen.getByText('Выберите перевод')).toBeOnTheScreen();
    expect(screen.queryByText('Не совсем')).not.toBeOnTheScreen();
  });

  it('shows the hint on request', async () => {
    const user = userEvent.setup();
    await render(<LessonScreen session={lesson1} onExit={jest.fn()} />);
    await press(user, 'Подсказка');
    expect(screen.getByText('Этим жестом машут при встрече.')).toBeOnTheScreen();
  });

  it('asks before leaving and saves nothing', async () => {
    const user = userEvent.setup();
    const onExit = jest.fn();
    const onComplete = jest.fn();
    await render(<LessonScreen session={lesson1} onExit={onExit} onComplete={onComplete} />);
    await press(user, 'Закрыть урок');
    expect(screen.getByText('Закончить урок?')).toBeOnTheScreen();
    await press(user, 'Продолжить урок');
    expect(screen.queryByText('Закончить урок?')).not.toBeOnTheScreen();
    await press(user, 'Закрыть урок');
    await press(user, 'Выйти');
    expect(onExit).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('skips listening exercises when the learner cannot listen', async () => {
    const user = userEvent.setup();
    await render(<LessonScreen session={sessionForLesson('a1.u01.l03')} onExit={jest.fn()} />);
    expect(screen.getByText('Какую букву вы слышите?')).toBeOnTheScreen();
    await press(user, 'Не могу слушать сейчас');
    expect(await screen.findByText('Найдите пары')).toBeOnTheScreen();
  });

  it('saves the result once and shows XP and streak', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn(async (_summary: LessonSummary) => info);
    await render(<LessonScreen session={tiny} onExit={jest.fn()} onComplete={onComplete} />);
    await press(user, 'hello');
    await press(user, 'Проверить');
    await press(user, 'Дальше');

    expect(await screen.findByText('+16')).toBeOnTheScreen();
    expect(screen.getByText('Урок пройден!')).toBeOnTheScreen();
    expect(screen.getByText(/Серия: 1 день подряд/)).toBeOnTheScreen();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ answered: 1, correctFirstTry: 1 });
  });

  it('offers to retry when saving fails', async () => {
    const user = userEvent.setup();
    const onComplete = jest
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(info);
    await render(<LessonScreen session={tiny} onExit={jest.fn()} onComplete={onComplete} />);
    await press(user, 'hello');
    await press(user, 'Проверить');
    await press(user, 'Дальше');

    expect(await screen.findByText(/Не удалось сохранить результат: disk full/)).toBeOnTheScreen();
    await press(user, 'Попробовать ещё раз');
    expect(await screen.findByText('+16')).toBeOnTheScreen();
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('reports a missing lesson and an empty session', async () => {
    await render(<LessonScreen session={null} onExit={jest.fn()} />);
    expect(screen.getByText('Урок не найден')).toBeOnTheScreen();
    await screen.unmount();
    await render(<LessonScreen session={{ ...tiny, exercises: [] }} onExit={jest.fn()} />);
    expect(screen.getByText('Здесь пока нечего повторять')).toBeOnTheScreen();
  });
});

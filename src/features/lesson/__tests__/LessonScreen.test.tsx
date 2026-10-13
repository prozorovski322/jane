import { render, screen, userEvent } from '@testing-library/react-native';

import { LessonScreen } from '../LessonScreen';

const press = (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  user.press(screen.getByRole('button', { name }));

describe('LessonScreen', () => {
  it('checks an answer, explains it and moves on', async () => {
    const user = userEvent.setup();
    await render(<LessonScreen lessonId="a1.u01.l01" onExit={jest.fn()} />);

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
    await render(<LessonScreen lessonId="a1.u01.l01" onExit={jest.fn()} />);
    await press(user, 'Подсказка');
    expect(screen.getByText('Этим жестом машут при встрече.')).toBeOnTheScreen();
  });

  it('asks before leaving and reports no result', async () => {
    const user = userEvent.setup();
    const onExit = jest.fn();
    await render(<LessonScreen lessonId="a1.u01.l01" onExit={onExit} />);
    await press(user, 'Закрыть урок');
    expect(screen.getByText('Закончить урок?')).toBeOnTheScreen();
    await press(user, 'Продолжить урок');
    expect(screen.queryByText('Закончить урок?')).not.toBeOnTheScreen();
    await press(user, 'Закрыть урок');
    await press(user, 'Выйти');
    expect(onExit).toHaveBeenCalledWith(null);
  });

  it('skips listening exercises when the learner cannot listen', async () => {
    const user = userEvent.setup();
    await render(<LessonScreen lessonId="a1.u01.l03" onExit={jest.fn()} />);
    // Lesson 3 starts with three "which letter do you hear?" exercises.
    expect(screen.getByText('Какую букву вы слышите?')).toBeOnTheScreen();
    await press(user, 'Не могу слушать сейчас');
    expect(await screen.findByText('Найдите пары')).toBeOnTheScreen();
  });

  it('reports an unknown lesson', async () => {
    const onExit = jest.fn();
    await render(<LessonScreen lessonId="a1.u99.l01" onExit={onExit} />);
    expect(screen.getByText('Урок не найден')).toBeOnTheScreen();
  });
});

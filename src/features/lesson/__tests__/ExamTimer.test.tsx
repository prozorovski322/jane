import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { clock, ExamTimer } from '../components/ExamTimer';

describe('ExamTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('formats minutes and seconds', () => {
    expect(clock(120)).toBe('2:00');
    expect(clock(65)).toBe('1:05');
    expect(clock(0)).toBe('0:00');
  });

  it('runs preparation, then speaking, then stops', async () => {
    await render(<ExamTimer prepare={60} speak={120} />);
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Засечь время, как на экзамене' })),
    );
    expect(screen.getByText(/Подготовка/)).toBeOnTheScreen();
    expect(screen.getByText('1:00')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(30_000));
    expect(screen.getByText('0:30')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(31_000));
    expect(screen.getByText('Говорите')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(121_000));
    expect(screen.getByText(/Время вышло/)).toBeOnTheScreen();
  });

  it('lets the learner start speaking early and finish early', async () => {
    await render(<ExamTimer prepare={60} speak={120} />);
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Засечь время, как на экзамене' })),
    );
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Готов(а) говорить' })),
    );
    expect(screen.getByText('2:00')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Закончил(а)' })));
    expect(screen.getByText(/Готово/)).toBeOnTheScreen();
  });
});

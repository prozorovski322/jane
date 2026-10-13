import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { getLexicon, getUnit } from '@/core/content';
import type { Exercise, ExerciseOf } from '@/core/content/schema';
import { getAiKey } from '@/core/checker/ai-key';
import { requestAiReview } from '@/core/checker/ai-review';
import { checkExercise, type Response } from '@/core/scoring/check';
import {
  setRecognizer,
  SpeechError,
  unavailableRecognizer,
  type ListenOptions,
  type SpeechRecognizer,
} from '@/core/speech/stt';
import { tts } from '@/core/speech/tts';

import { ExerciseView } from '../exercises/ExerciseView';
import type { ExerciseContext } from '../exercises/types';

jest.mock('@/core/checker/ai-key', () => ({ getAiKey: jest.fn(async () => null) }));
jest.mock('@/core/checker/ai-review', () => ({
  ...jest.requireActual('@/core/checker/ai-review'),
  requestAiReview: jest.fn(),
}));

const unit = getUnit('a1.u01');
const all: Exercise[] = [...unit.lessons.flatMap((l) => l.exercises), ...unit.test.exercises];
const find = <T extends Exercise['type']>(
  type: T,
  pred: (e: ExerciseOf<T>) => boolean = () => true,
) => all.find((e): e is ExerciseOf<T> => e.type === type && pred(e as ExerciseOf<T>))!;

const lexicon = getLexicon();
const ctx: ExerciseContext = {
  word: (id) => lexicon.get(id),
  text: (id) => unit.texts.find((t) => t.id === id),
  cantListen: false,
};

async function show(exercise: Exercise, verdictFor?: Response) {
  let last: Response | null = null;
  await render(
    <ExerciseView
      exercise={exercise}
      onChange={(r) => (last = r)}
      verdict={verdictFor ? checkExercise(exercise, verdictFor) : null}
      seed="test"
      ctx={ctx}
    />,
  );
  return () => last;
}

const press = (name: string | RegExp) =>
  userEvent.setup().press(screen.getByRole('button', { name }));

function fakeRecognizer(listen: (o: ListenOptions) => Promise<string>): SpeechRecognizer {
  return { isAvailable: async () => true, listen, stop: jest.fn() };
}

afterEach(() => setRecognizer(unavailableRecognizer));

describe('speaking with a recognizer', () => {
  const ex = find('speak_repeat');

  it('offers recognition, shows interim text and reports what was heard', async () => {
    let finish!: (t: string) => void;
    let interim!: (t: string) => void;
    setRecognizer(
      fakeRecognizer((o) => {
        interim = o.onInterim!;
        return new Promise((resolve) => (finish = resolve));
      }),
    );
    const latest = await show(ex);
    await press('Говорить');
    await act(async () => interim('my na'));
    await waitFor(() => expect(screen.getByText(/Слышу: «my na»/)).toBeOnTheScreen());
    await act(async () => finish(ex.text));
    await waitFor(() => expect(screen.getByText(`Распознано: «${ex.text}»`)).toBeOnTheScreen());
    expect(latest()).toEqual({ kind: 'speech', transcript: ex.text });
  });

  it('explains a failed attempt and lets the learner try again', async () => {
    setRecognizer(
      fakeRecognizer(async () => {
        throw new SpeechError('no-speech');
      }),
    );
    await show(ex);
    await press('Говорить');
    await waitFor(() => expect(screen.getByText(/Не расслышал/)).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Говорить' })).toBeOnTheScreen();
  });

  it('without a recognizer the learner can record and replay themselves, then compare', async () => {
    await show(ex);
    await press('Сказать и проверить себя');
    expect(screen.queryByRole('button', { name: 'Говорить' })).not.toBeOnTheScreen();
    await press('Записать себя');
    await press('Стоп');
    await screen.findByRole('button', { name: 'Послушать себя' });
    await press('Послушать себя');
    await press('Остановить');
    await press('Я сказал(а), показать образец');
    expect(screen.getAllByRole('button', { name: /Прослушать образец/ })).toHaveLength(2);
  });

  it('names the words that were not heard in the verdict', () => {
    const v = checkExercise(ex, {
      kind: 'speech',
      transcript: ex.text.split(' ').slice(1).join(' '),
    });
    expect(v.speech?.missing?.length).toBeGreaterThan(0);
  });
});

describe('listening', () => {
  const ex = find('comprehension', (e) => e.mode === 'listening');

  it('plays the dialogue slowly when asked and highlights nothing when idle', async () => {
    await show(ex);
    await press('Медленнее');
    expect(screen.getByRole('button', { name: 'Обычно' })).toBeOnTheScreen();
    await press('Слушать диалог');
    await waitFor(() =>
      expect(tts.speak).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ slow: true }),
      ),
    );
  });

  it('shows the transcript once the answers are checked', async () => {
    const answers = ex.questions.map((q) => (q.kind === 'mcq' ? q.answer : q.answer));
    await show(ex, { kind: 'answers', answers });
    expect(screen.getByText(/Are you Max\?/)).toBeOnTheScreen();
  });
});

describe('writing: optional AI review', () => {
  const ex = find('write');
  const checked: Response = { kind: 'text', text: ex.samples[0]! };

  beforeEach(() => jest.mocked(getAiKey).mockResolvedValue(null));

  it('is not offered without a key', async () => {
    await show(ex, checked);
    expect(screen.queryByText('Разбор нейросетью')).not.toBeOnTheScreen();
  });

  it('sends the text only after the button is pressed and shows the review', async () => {
    jest.mocked(getAiKey).mockResolvedValue('sk-test');
    jest.mocked(requestAiReview).mockResolvedValue({
      summary: 'Хороший текст.',
      corrected: 'I like tea.',
      issues: [{ original: 'I likes', fix: 'I like', why: 'без -s' }],
    });
    await show(ex, checked);
    await screen.findByText('Разбор нейросетью');
    expect(requestAiReview).not.toHaveBeenCalled();
    await press('Проверить нейросетью');
    await screen.findByText('Хороший текст.');
    expect(requestAiReview).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-test', task: ex.task }),
    );
    expect(screen.getByText(/«I likes» → «I like»/)).toBeOnTheScreen();
  });
});

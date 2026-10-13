import { render, screen, userEvent } from '@testing-library/react-native';

import { getLexicon, getUnit } from '@/core/content';
import type { Exercise, ExerciseOf } from '@/core/content/schema';
import { checkExercise, type Response } from '@/core/scoring/check';

import { ExerciseView } from '../exercises/ExerciseView';
import type { ExerciseContext } from '../exercises/types';

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

/** Renders an exercise and returns a getter for the latest response it reported. */
async function show(exercise: Exercise, context: ExerciseContext = ctx) {
  let last: Response | null = null;
  await render(
    <ExerciseView
      exercise={exercise}
      onChange={(r) => (last = r)}
      verdict={null}
      seed="test"
      ctx={context}
    />,
  );
  return () => last;
}

const press = (name: string | RegExp) =>
  userEvent.setup().press(screen.getByRole('button', { name }));

describe('exercise views report responses that check correctly', () => {
  it('translate_choice', async () => {
    const ex = find('translate_choice');
    const latest = await show(ex);
    await press(ex.options[ex.answer]!);
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('picture_choice', async () => {
    const ex = find('picture_choice', (e) => e.mode === 'picture-to-word');
    const latest = await show(ex);
    await press(lexicon.get(ex.word)!.en);
    expect(latest()).toEqual({ kind: 'word', wordId: ex.word });
  });

  it('tiles: tapping tiles builds the answer; tapping again removes', async () => {
    const ex = find('tiles', (e) => e.answer === 'Nice to meet you!');
    const latest = await show(ex);
    for (const w of ['Nice', 'to', 'see']) await press(w);
    // Remove the distractor from the answer row (the first "see" button is the placed tile).
    await press('see');
    for (const w of ['meet', 'you']) await press(w);
    expect(latest()).toEqual({ kind: 'tiles', tiles: ['Nice', 'to', 'meet', 'you'] });
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('type_translation', async () => {
    const ex = find('type_translation', (e) => e.text === 'Спасибо!');
    const latest = await show(ex);
    await userEvent.setup().type(screen.getByLabelText('Перевод'), 'Thank you');
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('fill_gap with options', async () => {
    const ex = find('fill_gap', (e) => !!e.options && e.text.startsWith('He'));
    const latest = await show(ex);
    await press('an');
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('fill_gap with several typed gaps', async () => {
    const ex = find('fill_gap', (e) => e.answers.length === 3);
    const latest = await show(ex);
    const user = userEvent.setup();
    const answers = ['My', 'an', 'meet'];
    for (const [i, a] of answers.entries())
      await user.type(screen.getByLabelText(`Пропуск ${i + 1}`), a);
    expect(latest()).toEqual({ kind: 'gaps', values: answers });
  });

  it('match_pairs counts mistakes and reports when every pair is found', async () => {
    const ex = find('match_pairs', (e) => e.pairs[0]!.en === 'hello');
    const latest = await show(ex);
    await press('hello');
    await press('спасибо'); // wrong pair
    for (const p of ex.pairs) {
      await press(new RegExp(`^${p.en}`));
      await press(p.ru);
    }
    expect(latest()).toEqual({ kind: 'pairs', mistakes: 1 });
  });

  it('error_correction: tap the wrong word, then choose the fix', async () => {
    const ex = find('error_correction', (e) => e.text === 'He are a doctor.');
    const latest = await show(ex);
    await press('are');
    expect(latest()).toBeNull();
    await press('is');
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('comprehension: reports once every question is answered', async () => {
    const ex = find('comprehension', (e) => e.mode === 'reading');
    const latest = await show(ex);
    expect(screen.getByText(/Hi! I'm Elena/)).toBeOnTheScreen();
    for (const [i, q] of ex.questions.entries()) {
      const label =
        q.kind === 'mcq'
          ? q.options[q.answer]!
          : { true: 'Верно', false: 'Неверно', not_given: 'Нет информации' }[q.answer];
      const buttons = screen.getAllByRole('button', { name: label });
      // True/false buttons repeat per question; take the one of question i.
      const tfnIndex = ex.questions.slice(0, i).filter((x) => x.kind === 'tfn').length;
      await userEvent.setup().press(q.kind === 'mcq' ? buttons[0]! : buttons[tfnIndex]!);
    }
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('listening comprehension hides the transcript until asked, unless the learner cannot listen', async () => {
    const ex = find('comprehension', (e) => e.mode === 'listening');
    await show(ex);
    expect(screen.queryByText(/Are you Max\?/)).not.toBeOnTheScreen();
    await press('Показать текст');
    expect(screen.getByText(/Are you Max\?/)).toBeOnTheScreen();
  });

  it('speaking: self-check and typed alternative', async () => {
    const ex = find('speak_answer', (e) => e.question === 'Where are you from?');
    let latest = await show(ex);
    await press('Сказать и проверить себя');
    await press('Я сказал(а), показать образец');
    await press('Да, получилось');
    expect(latest()).toEqual({ kind: 'self', ok: true });

    await screen.unmount();
    latest = await show(ex);
    await press('Ответить текстом');
    await userEvent.setup().type(screen.getByLabelText('Ваш ответ'), "I'm from Kazan");
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('write: counts words live', async () => {
    const ex = find('write');
    const latest = await show(ex);
    await userEvent.setup().type(screen.getByLabelText('Ваш текст'), ex.samples[0]!);
    expect(screen.getByText(/Слов: 16/)).toBeOnTheScreen();
    expect(checkExercise(ex, latest()!).correct).toBe(true);
  });

  it('minimal_pair and word_stress', async () => {
    const pair = find('minimal_pair');
    let latest = await show(pair);
    await press(new RegExp(`^${pair.pair[pair.say].en}`));
    expect(checkExercise(pair, latest()!).correct).toBe(true);

    await screen.unmount();
    const stress = find('word_stress', (e) => e.word === 'engineer');
    latest = await show(stress);
    await press('neer, слог 3');
    expect(checkExercise(stress, latest()!).correct).toBe(true);
  });
});

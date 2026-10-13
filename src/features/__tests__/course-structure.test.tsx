import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { getGrammarNote, getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';
import { setDb } from '@/core/storage';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { CertificateScreen, shareText } from '../certificates/CertificateScreen';
import { awardExamCertificate } from '../certificates/service';
import { searchGrammar } from '../grammar/search';
import { GrammarListScreen } from '../grammar/GrammarScreens';
import { MistakesScreen } from '../mistakes/MistakesScreen';
import { findExercise, loadMistakes, promptOf } from '../mistakes/service';
import { PathScreen } from '../path/PathScreen';
import { buildPractice, type PracticeSources } from '../practice/build';
import { estimateWeeks, remainingInLevel, weeksPhrase } from '../progress/eta';
import { recordSession } from '../progress/service';
import { useProgress } from '../progress/store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;

const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const press = (name: string | RegExp) =>
  userEvent.setup().press(screen.getByRole('button', { name }));

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

/** Records a session in which the given exercises were answered right or wrong. */
async function answer(results: [id: string, correct: boolean][], now: Date) {
  await recordSession(
    db,
    { id: 'a1.u01.l01', unitId: 'a1.u01', kind: 'lesson' },
    {
      lessonId: 'a1.u01.l01',
      total: results.length,
      answered: results.length,
      skipped: 0,
      correctFirstTry: results.filter(([, c]) => c).length,
      accuracy: 0.5,
      score: 0.5,
      durationMs: 60_000,
      outcomes: results.map(([exerciseId, correct]) => ({
        exerciseId,
        correct,
        score: correct ? 1 : 0,
        usedHint: false,
        words: [],
        grammar: [],
        troubles: [],
        skill: 'vocabulary' as const,
      })),
    },
    { now },
  );
}

describe('Path', () => {
  it('shows the levels with modules, units to come and exams', async () => {
    await render(<PathScreen />);
    expect(screen.getByText('Pre-A1 · С нуля')).toBeOnTheScreen();
    expect(screen.getByText('A1 · Начальный')).toBeOnTheScreen();
    expect(screen.getByText('Модуль 1 · Я и другие')).toBeOnTheScreen();
    expect(screen.getByLabelText('Юнит 2: Семья и друзья. Скоро.')).toBeOnTheScreen();
    expect(
      screen.getAllByText(/Появится, когда будут готовы все юниты модуля/).length,
    ).toBeGreaterThan(3);
    expect(screen.getByText('Экзамен уровня A1')).toBeOnTheScreen();
  });

  it('shows the goals of a level on request', async () => {
    await render(<PathScreen />);
    expect(screen.queryByText('После уровня я смогу:')).not.toBeOnTheScreen();
    await userEvent.setup().press(screen.getAllByRole('button', { name: 'Цели уровня' })[1]!);
    expect(screen.getByText('После уровня я смогу:')).toBeOnTheScreen();
    expect(screen.getByText(/Могу представиться, рассказать о себе/)).toBeOnTheScreen();
  });

  it('marks a level with a certificate', async () => {
    await awardExamCertificate(db, 'A1', 0.9, at('2026-10-13'));
    await render(<PathScreen />);
    await press('Сертификат');
    expect(mockRouter.push).toHaveBeenCalledWith('/certificate/a1');
  });
});

describe('Certificate screen', () => {
  it('shows the certificate with the level goals and an honest note', async () => {
    await awardExamCertificate(db, 'A1', 0.88, at('2026-10-13'));
    await render(<CertificateScreen level="a1" />);
    expect(await screen.findByText(/экзамен сдан на 88%/)).toBeOnTheScreen();
    expect(screen.getByText(/не официальный документ CEFR/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Поделиться' })).toBeOnTheScreen();
  });

  it('sends the learner to the exam when there is no certificate yet', async () => {
    await render(<CertificateScreen level="a1" />);
    await screen.findByText(/пока нет/);
    await press('К экзамену уровня');
    expect(mockRouter.replace).toHaveBeenCalledWith('/lesson/a1.exam');
  });

  it('composes the text to share', () => {
    expect(shareText('A2', 0.91)).toBe(
      'Я прошёл(а) уровень A2 в приложении Jane. Результат экзамена: 91%.',
    );
  });
});

const exerciseIds = getUnit('a1.u01').lessons[0]!.exercises.map((e) => e.id);

describe('Mistakes', () => {
  it('lists exercises whose latest answer was wrong, and drops them once answered right', async () => {
    await answer(
      [
        [exerciseIds[0]!, false],
        [exerciseIds[1]!, false],
        ['review.word.hello', false],
      ],
      at('2026-10-13', 9),
    );
    let list = await loadMistakes(db, at('2026-10-13', 12));
    expect(list.map((m) => m.exercise.id).sort()).toEqual([exerciseIds[0], exerciseIds[1]].sort());

    await answer([[exerciseIds[0]!, true]], at('2026-10-14'));
    list = await loadMistakes(db, at('2026-10-14', 12));
    expect(list.map((m) => m.exercise.id)).toEqual([exerciseIds[1]]);
  });

  it('forgets mistakes older than 30 days', async () => {
    await answer([[exerciseIds[0]!, false]], at('2026-09-01'));
    expect(await loadMistakes(db, at('2026-10-13'))).toEqual([]);
  });

  it('finds course exercises by id and describes them', () => {
    const ex = findExercise(exerciseIds[1]!)!;
    expect(ex.id).toBe(exerciseIds[1]);
    expect(promptOf(ex)).toBe('Good evening!');
    expect(findExercise('a1.u01.test.e02')).not.toBeNull();
    expect(findExercise('a9.u01.l01.e01')).toBeNull();
    expect(findExercise('review.word.hello')).toBeNull();
  });

  it('shows the list on screen with a button to practise', async () => {
    await answer([[exerciseIds[1]!, false]], new Date());
    await render(<MistakesScreen />);
    expect(await screen.findByText('Good evening!')).toBeOnTheScreen();
    expect(screen.getByText(/Правильно: Добрый вечер!/)).toBeOnTheScreen();
    await press('Потренировать (1)');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/practice/[kind]',
      params: { kind: 'mistakes' },
    });
  });

  it('says so when there are none', async () => {
    await render(<MistakesScreen />);
    expect(await screen.findByText(/Сейчас неверных ответов нет/)).toBeOnTheScreen();
  });
});

describe('practice: mistakes and mixed grammar', () => {
  const all: Exercise[] = getUnit('a1.u01').lessons.flatMap((l) => l.exercises);
  const src = (patch: Partial<PracticeSources>): PracticeSources => ({
    seen: all,
    all,
    wordCards: [],
    word: () => undefined,
    words: [],
    weak: [],
    ...patch,
  });

  it('practises only the mistakes', () => {
    const wrong = all.slice(0, 3);
    const list = buildPractice({ kind: 'mistakes' }, src({ mistakes: wrong }), 's');
    expect(list.map((e) => e.id).sort()).toEqual(wrong.map((e) => e.id).sort());
    expect(buildPractice({ kind: 'mistakes' }, src({}), 's')).toEqual([]);
  });

  it('mixes grammar: at most two exercises per rule', () => {
    const list = buildPractice({ kind: 'grammar-mix' }, src({}), 's');
    expect(list.length).toBeGreaterThan(0);
    const perRule = new Map<string, number>();
    for (const e of list) perRule.set(e.grammar[0]!, (perRule.get(e.grammar[0]!) ?? 0) + 1);
    expect(Math.max(...perRule.values())).toBeLessThanOrEqual(2);
    expect(list.every((e) => e.grammar.length > 0)).toBe(true);
  });
});

describe('time to the next level', () => {
  it('needs a few lessons of history and then follows the pace', () => {
    expect(estimateWeeks(20, 2)).toBeNull();
    expect(estimateWeeks(0, 10)).toBeNull();
    // 7 lessons in 14 days = 3.5 a week.
    expect(estimateWeeks(7, 7)).toBe(2);
    expect(estimateWeeks(1, 28)).toBe(1);
  });

  it('counts what is left in the written units of a level', () => {
    expect(remainingInLevel('A1', new Set())).toBe(8);
    expect(remainingInLevel('A1', new Set(['a1.u01.l01', 'a1.u01.test']))).toBe(6);
    expect(remainingInLevel('PA1', new Set())).toBe(0);
  });

  it('phrases weeks in Russian', () => {
    expect(weeksPhrase(1)).toBe('около недели');
    expect(weeksPhrase(2)).toBe('около 2 недель');
    expect(weeksPhrase(5)).toBe('около 5 недель');
    expect(weeksPhrase(21)).toBe('около 21 недели');
    expect(weeksPhrase(11)).toBe('около 11 недель');
  });
});

describe('grammar search', () => {
  const notes = ['a1.be-present', 'a1.articles-a-an', 'a1.alphabet'].map((id) =>
    getGrammarNote(id)!,
  );

  it('finds notes by title, summary and text, in either language', () => {
    expect(searchGrammar(notes, 'артикль').map((n) => n.id)).toContain('a1.articles-a-an');
    expect(searchGrammar(notes, 'an engineer').length).toBeGreaterThan(0);
    expect(searchGrammar(notes, 'qwertyuiop')).toEqual([]);
    expect(searchGrammar(notes, '   ')).toHaveLength(notes.length);
  });

  it('requires every word and ignores case and ё', () => {
    expect(searchGrammar(notes, 'АРТИКЛЬ a an').length).toBeGreaterThan(0);
    expect(searchGrammar(notes, 'артикль zzzz')).toEqual([]);
  });

  it('filters the reference screen as you type', async () => {
    await render(<GrammarListScreen />);
    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(2));
    await userEvent.setup().type(screen.getByLabelText('Поиск по правилам'), 'zzzzzz');
    expect(await screen.findByText(/Ничего не нашлось/)).toBeOnTheScreen();
  });
});

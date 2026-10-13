/** Path state, weak spots, practice sessions, dictionary search, own words and favorites. */
import { getCourse, getLexicon, getUnit } from '@/core/content';
import type { Exercise } from '@/core/content/schema';
import { newCard, State, type SrsCard } from '@/core/srs/scheduler';
import { exportSnapshot, importSnapshot, parseSnapshot } from '@/core/storage/backup';
import { migrate, MIGRATIONS } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import {
  addUserWord,
  deleteUserWord,
  listFavorites,
  listUserWords,
  setFavorite,
} from '@/core/storage/words-repo';
import { saveCard } from '@/core/storage/srs-repo';

import { fromLexicon, fromUserWord } from '../dictionary/entries';
import { searchDictionary, wordStatus, type DictFilter } from '../dictionary/search';
import { pathState } from '../path/state';
import { buildPractice, type PracticeSources } from '../practice/build';
import { weakSpotsFrom, type AttemptRow } from '../progress/insights';

const now = new Date('2026-10-13T10:00:00');

describe('pathState', () => {
  it('marks done lessons and points to the first unfinished one', () => {
    // Everything before A1 is done, so the next lesson is in the A1 unit.
    const before = getCourse()
      .levels.filter((l) => l.level === 'PA1')
      .flatMap((l) => l.units.flatMap((u) => [...u.lessons.map((x) => x.id), `${u.id}.test`]));
    const s = pathState(
      getCourse(),
      new Set([...before, 'a1.u01.l01', 'a1.u01.l02', 'a1.u01.l04']),
    );
    const unit = s.levels.find((l) => l.level === 'A1')!.units[0]!;
    expect(unit.nodes.map((n) => n.status)).toEqual([
      'done',
      'done',
      'next',
      'done',
      'open',
      'open',
      'open',
      'open',
    ]);
    expect(s.next?.node.id).toBe('a1.u01.l03');
    expect(unit.done).toBe(3);
    expect(unit.total).toBe(8);
  });

  it('has no next lesson when everything is done', () => {
    const all = getCourse().levels.flatMap((l) =>
      l.units.flatMap((u) => [...u.lessons.map((x) => x.id), `${u.id}.test`]),
    );
    expect(pathState(getCourse(), new Set(all)).next).toBeNull();
  });
});

describe('weakSpotsFrom', () => {
  const row = (correct: boolean, grammar: string[], troubles: string[] = []): AttemptRow => ({
    correct: correct ? 1 : 0,
    skill: 'grammar',
    grammar: JSON.stringify(grammar),
    troubles: JSON.stringify(troubles),
    at: 0,
  });

  it('finds rules and difficulties with low accuracy and enough attempts', () => {
    const rows = [
      ...[false, false, true, false].map((c) => row(c, ['a1.articles-a-an'], ['articles'])),
      ...[true, true, true, true].map((c) => row(c, ['a1.be-present'])),
      row(false, ['a1.alphabet']), // a single mistake is not a pattern yet
    ];
    const spots = weakSpotsFrom(rows, (k, r) => `${k}:${r}`);
    expect(spots.map((s) => s.ref)).toEqual(['a1.articles-a-an', 'articles']);
    expect(spots[0]).toMatchObject({ kind: 'grammar', attempts: 4, accuracy: 0.25 });
  });
});

describe('buildPractice', () => {
  const unit = getUnit('a1.u01');
  const all: Exercise[] = unit.lessons.flatMap((l) => l.exercises);
  const lexicon = getLexicon();
  const src = (seen: Exercise[], wordCards: SrsCard[] = []): PracticeSources => ({
    seen,
    all,
    wordCards,
    word: (id) => lexicon.get(id),
    words: [...lexicon.values()],
    weak: [],
  });

  it('builds skill practice only from completed lessons', () => {
    const listening = buildPractice({ kind: 'listening' }, src(unit.lessons[4]!.exercises), 's');
    expect(listening.length).toBeGreaterThan(0);
    expect(
      listening.every((e) =>
        ['listen_choice', 'listen_dictation', 'minimal_pair', 'comprehension'].includes(e.type),
      ),
    ).toBe(true);
    expect(buildPractice({ kind: 'listening' }, src([]), 's')).toEqual([]);
  });

  it('practices a grammar rule from the whole course when little was seen', () => {
    const ex = buildPractice({ kind: 'grammar', ref: 'a1.be-present' }, src([]), 's');
    expect(ex.length).toBe(10);
    expect(ex.every((e) => e.grammar.includes('a1.be-present'))).toBe(true);
    expect(new Set(ex.map((e) => e.id)).size).toBe(ex.length);
  });

  it('practices the hardest words first', () => {
    const cards = ['hello', 'teacher', 'doctor'].map((w, i) => ({
      ...newCard('word', w, now),
      lapses: i,
      state: State.Review,
      stability: 2,
    }));
    const ex = buildPractice({ kind: 'words' }, src([], cards), 's');
    expect(ex.map((e) => e.words[0])).toEqual(['doctor', 'teacher', 'hello']);
  });

  it('weak spots combine rule exercises and lapsed words', () => {
    const cards = [{ ...newCard('word', 'nurse', now), lapses: 2 }];
    const ex = buildPractice(
      { kind: 'weak' },
      {
        ...src(all, cards),
        weak: [{ kind: 'trouble', ref: 'articles', label: 'Артикли', attempts: 5, accuracy: 0.2 }],
      },
      's',
    );
    expect(ex.some((e) => e.troubles.includes('articles'))).toBe(true);
    expect(ex.some((e) => e.words.includes('nurse') && e.id.startsWith('review.'))).toBe(true);
  });
});

describe('dictionary search', () => {
  const entries = [...getLexicon().values()].map(fromLexicon);
  const f = (patch: Partial<DictFilter>): DictFilter => ({
    query: '',
    levels: [],
    status: 'all',
    ...patch,
  });
  const ctx = { cards: new Map<string, SrsCard>(), favorites: new Set<string>() };

  it('ranks exact and prefix matches first, in English and Russian', () => {
    expect(searchDictionary(entries, f({ query: 'he' }), ctx)[0]!.en).toBe('he');
    expect(searchDictionary(entries, f({ query: 'Учитель' }), ctx)[0]!.en).toBe('teacher');
    expect(searchDictionary(entries, f({ query: 'morn' }), ctx)[0]!.en).toBe('good morning');
  });

  it('ignores ё', () => {
    expect(searchDictionary(entries, f({ query: 'еще раз' }), ctx).map((e) => e.en)).toContain(
      'again',
    );
  });

  it('filters by status', () => {
    const cards = new Map([
      ['word:hello', { ...newCard('word', 'hello', now), state: State.Review, stability: 40 }],
      ['word:bye', newCard('word', 'bye', now)],
    ]);
    const c = { cards, favorites: new Set(['sorry']) };
    expect(searchDictionary(entries, f({ status: 'known' }), c).map((e) => e.id)).toEqual([
      'hello',
    ]);
    expect(searchDictionary(entries, f({ status: 'learning' }), c).map((e) => e.id)).toEqual([
      'bye',
    ]);
    expect(searchDictionary(entries, f({ status: 'favorites' }), c).map((e) => e.id)).toEqual([
      'sorry',
    ]);
    expect(wordStatus('teacher', cards)).toBe('new');
  });
});

describe('own words and favorites', () => {
  it('adds, lists, favorites and deletes own words with their cards', async () => {
    const db = openNodeDb();
    await migrate(db);
    const w = await addUserWord(
      db,
      { en: 'deadline', ru: ['срок', ' крайний срок '], note: 'с работы' },
      now,
    );
    expect(w).toMatchObject({
      id: 'user-1',
      en: 'deadline',
      ru: ['срок', 'крайний срок'],
      example: null,
    });
    await setFavorite(db, w.id, true, now);
    await setFavorite(db, 'hello', true, now);
    await saveCard(db, newCard('word', w.id, now));
    expect([...(await listFavorites(db))].sort()).toEqual(['hello', 'user-1']);
    expect(
      searchDictionary(
        [fromUserWord(w)],
        { query: 'срок', levels: [], status: 'mine' },
        { cards: new Map(), favorites: new Set() },
      ),
    ).toHaveLength(1);

    await deleteUserWord(db, w.id);
    expect(await listUserWords(db)).toEqual([]);
    expect([...(await listFavorites(db))]).toEqual(['hello']);
    expect(await db.get("SELECT COUNT(*) AS n FROM srs_cards WHERE id = 'word:user-1'")).toEqual({
      n: 0,
    });
    await db.close();
  });

  it('imports a backup made before own words existed', async () => {
    // What the schema-1 app wrote: no favorites or user_words tables.
    const v1Tables = [
      'kv',
      'lesson_results',
      'attempts',
      'lesson_progress',
      'daily_activity',
      'streak_freezes',
      'srs_cards',
      'srs_log',
    ];
    const json = JSON.stringify({
      app: 'jane',
      schema: MIGRATIONS[0]!.version,
      exportedAt: now.toISOString(),
      tables: {
        ...Object.fromEntries(v1Tables.map((t) => [t, []])),
        kv: [{ key: 'x', value: '1' }],
      },
    });

    const db = openNodeDb();
    await migrate(db);
    await importSnapshot(db, parseSnapshot(json));
    expect(await db.get("SELECT value FROM kv WHERE key = 'x'")).toEqual({ value: '1' });
    expect((await exportSnapshot(db)).tables.favorites).toEqual([]);
    await db.close();
  });
});

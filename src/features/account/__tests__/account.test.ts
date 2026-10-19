import { oauthProviders } from '@/core/account/config';
import type { Db } from '@/core/storage/db';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';
import type { LessonSummary } from '@/features/lesson/engine';
import { recordSession } from '@/features/progress/service';

import { formProblem } from '../AuthScreen';
import { accountMessage, syncProgress, weekStart } from '../service';

/** An in-memory stand-in for the two Supabase tables sync uses. */
const mockServer = {
  progress: new Map<string, Record<string, unknown>>(),
  stats: new Map<string, Record<string, unknown>>(),
};

jest.mock('@/core/account/client', () => ({
  supabase: () => ({
    from: (table: 'progress' | 'stats') => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({ data: mockServer[table].get(id) ?? null, error: null }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        mockServer[table].set(row.user_id as string, JSON.parse(JSON.stringify(row)));
        return { data: null, error: null };
      },
    }),
  }),
}));

const lesson = (lessonId: string): LessonSummary => ({
  lessonId,
  total: 1,
  answered: 1,
  skipped: 0,
  correctFirstTry: 1,
  accuracy: 1,
  score: 1,
  durationMs: 60_000,
  outcomes: [
    {
      exerciseId: `${lessonId}.e01`,
      correct: true,
      score: 1,
      usedHint: false,
      words: ['hello'],
      grammar: [],
      troubles: [],
      skill: 'vocabulary',
    },
  ],
});

async function device(lessonId: string, at: Date): Promise<Db> {
  const db = openNodeDb();
  await migrate(db);
  await recordSession(db, { id: lessonId, unitId: 'a1.u01', kind: 'lesson' }, lesson(lessonId), {
    now: at,
  });
  return db;
}

const completed = async (db: Db) =>
  (
    await db.all<{ lesson_id: string }>('SELECT lesson_id FROM lesson_progress ORDER BY lesson_id')
  ).map((r) => r.lesson_id);

describe('progress sync', () => {
  it('brings the progress of both devices together without losing any', async () => {
    const now = new Date('2026-10-19T10:00:00Z');
    const phone = await device('a1.u01.l01', now);
    const laptop = await device('a1.u01.l02', new Date('2026-10-19T11:00:00Z'));

    expect(await syncProgress(phone, 'u1', 1, now)).toBe('unchanged'); // first: just uploads
    expect(await syncProgress(laptop, 'u1', 1, now)).toBe('merged');
    expect(await completed(laptop)).toEqual(['a1.u01.l01', 'a1.u01.l02']);
    expect(await syncProgress(phone, 'u1', 1, now)).toBe('merged');
    expect(await completed(phone)).toEqual(['a1.u01.l01', 'a1.u01.l02']);
    // Nothing new: nothing changes any more.
    expect(await syncProgress(phone, 'u1', 1, now)).toBe('unchanged');
    expect(await syncProgress(laptop, 'u1', 1, now)).toBe('unchanged');

    const stats = mockServer.stats.get('u1')!;
    expect(stats.week_start).toBe('2026-10-19');
    expect(stats.total_xp).toBeGreaterThan(0);
    expect(stats.week_xp).toBe(stats.total_xp);
  });

  it('leaves progress saved by a newer app version alone', async () => {
    mockServer.progress.set('u2', { schema: 999, snapshot: {} });
    const db = await device('a1.u01.l01', new Date());
    expect(await syncProgress(db, 'u2', 0)).toBe('outdated');
    expect(mockServer.progress.get('u2')!.schema).toBe(999);
  });
});

describe('account helpers', () => {
  it('counts weeks from Monday', () => {
    expect(weekStart(new Date('2026-10-19T12:00:00Z'))).toBe('2026-10-19'); // Monday
    expect(weekStart(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-19'); // Sunday
    expect(weekStart(new Date('2026-10-26T00:30:00Z'))).toBe('2026-10-26');
  });

  it('shows only the configured sign-in buttons, in a fixed order', () => {
    expect(oauthProviders('custom:vk, google ,unknown')).toEqual(['google', 'custom:vk']);
    expect(oauthProviders('')).toEqual([]);
  });

  it('checks the sign-in and sign-up forms', () => {
    const f = { email: 'anna@example.com', password: 'secret12', name: 'Анна', consent: true };
    expect(formProblem('signin', f)).toBeNull();
    expect(formProblem('signup', f)).toBeNull();
    expect(formProblem('signin', { ...f, email: 'anna' })).toMatch(/почты/);
    expect(formProblem('signup', { ...f, password: 'short' })).toMatch(/не меньше 8/);
    expect(formProblem('signup', { ...f, consent: false })).toMatch(/согласие/);
    expect(formProblem('reset', { ...f, password: '' })).toBeNull();
  });

  it('explains server errors in Russian', () => {
    expect(accountMessage(new Error('Invalid login credentials'))).toBe(
      'Неверная почта или пароль.',
    );
    expect(accountMessage(new Error('User already registered'))).toMatch(/уже зарегистрирована/);
    expect(accountMessage(new Error('Failed to fetch'))).toMatch(/Нет связи/);
  });
});

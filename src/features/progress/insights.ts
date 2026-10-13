/**
 * What the learner's answers say: weak spots (grammar rules and typical difficulties with low
 * accuracy), accuracy per skill, recent history.
 */
import { getGrammarNote } from '@/core/content';
import type { Skill, Trouble } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';

export const TROUBLE_LABEL: Record<Trouble, string> = {
  articles: 'Артикли',
  'word-order': 'Порядок слов',
  tenses: 'Времена',
  prepositions: 'Предлоги',
  'false-friends': 'Ложные друзья',
  'pron-th': 'Звук th',
  'pron-wv': 'Звуки w и v',
  'pron-r': 'Звук r',
  'pron-vowels': 'Долгие и краткие гласные',
};

export const SKILL_LABEL: Record<Skill, string> = {
  vocabulary: 'Слова',
  grammar: 'Грамматика',
  listening: 'Аудирование',
  reading: 'Чтение',
  speaking: 'Говорение',
  writing: 'Письмо',
  pronunciation: 'Произношение',
};

export interface AttemptRow {
  correct: number;
  skill: string;
  grammar: string;
  troubles: string;
  at: number;
}

export interface WeakSpot {
  kind: 'grammar' | 'trouble';
  ref: string;
  label: string;
  attempts: number;
  accuracy: number;
}

const WINDOW_DAYS = 30;
const MIN_ATTEMPTS = 3;
const WEAK_BELOW = 0.75;

/** Accuracy with a mild prior, so two lucky answers do not look like mastery. */
function smoothed(correct: number, n: number): number {
  return (correct + 1) / (n + 2);
}

export function weakSpotsFrom(
  rows: readonly AttemptRow[],
  labelOf: (kind: WeakSpot['kind'], ref: string) => string,
): WeakSpot[] {
  const stats = new Map<string, { kind: WeakSpot['kind']; ref: string; n: number; c: number }>();
  const add = (kind: WeakSpot['kind'], ref: string, correct: boolean) => {
    const key = `${kind}:${ref}`;
    const s = stats.get(key) ?? { kind, ref, n: 0, c: 0 };
    s.n++;
    if (correct) s.c++;
    stats.set(key, s);
  };
  for (const r of rows) {
    for (const g of JSON.parse(r.grammar) as string[]) add('grammar', g, !!r.correct);
    for (const t of JSON.parse(r.troubles) as string[]) add('trouble', t, !!r.correct);
  }
  return [...stats.values()]
    .filter((s) => s.n >= MIN_ATTEMPTS && smoothed(s.c, s.n) < WEAK_BELOW)
    .map((s) => ({
      kind: s.kind,
      ref: s.ref,
      label: labelOf(s.kind, s.ref),
      attempts: s.n,
      accuracy: s.c / s.n,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

export function labelOf(kind: WeakSpot['kind'], ref: string): string {
  if (kind === 'trouble') return TROUBLE_LABEL[ref as Trouble] ?? ref;
  return getGrammarNote(ref)?.title ?? ref;
}

export async function loadWeakSpots(db: Db, now = new Date()): Promise<WeakSpot[]> {
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  const rows = await db.all<AttemptRow>(
    'SELECT correct, skill, grammar, troubles, at FROM attempts WHERE at >= ?',
    [since],
  );
  return weakSpotsFrom(rows, labelOf);
}

export interface SkillStat {
  skill: Skill;
  attempts: number;
  /** null when there are no attempts yet. */
  accuracy: number | null;
}

export async function loadSkillStats(db: Db): Promise<SkillStat[]> {
  const rows = await db.all<{ skill: Skill; n: number; c: number }>(
    'SELECT skill, COUNT(*) AS n, SUM(correct) AS c FROM attempts GROUP BY skill',
  );
  const by = new Map(rows.map((r) => [r.skill, r]));
  return (Object.keys(SKILL_LABEL) as Skill[]).map((skill) => {
    const r = by.get(skill);
    return { skill, attempts: r?.n ?? 0, accuracy: r && r.n ? r.c / r.n : null };
  });
}

export interface HistoryItem {
  id: number;
  lessonId: string;
  kind: string;
  day: string;
  accuracy: number;
  xp: number;
  passed: boolean;
}

export async function loadHistory(db: Db, limit = 20): Promise<HistoryItem[]> {
  const rows = await db.all<{
    id: number;
    lesson_id: string;
    kind: string;
    day: string;
    accuracy: number;
    xp: number;
    passed: number;
  }>(
    'SELECT id, lesson_id, kind, day, accuracy, xp, passed FROM lesson_results ORDER BY finished_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lesson_id,
    kind: r.kind,
    day: r.day,
    accuracy: r.accuracy,
    xp: r.xp,
    passed: !!r.passed,
  }));
}

/** What the learner did today, for the daily plan. */
export interface TodayActivity {
  lessons: Set<string>;
  practice: Set<string>;
  reviewed: boolean;
}

export async function loadToday(db: Db, day: string): Promise<TodayActivity> {
  const rows = await db.all<{ lesson_id: string; kind: string }>(
    'SELECT lesson_id, kind FROM lesson_results WHERE day = ?',
    [day],
  );
  return {
    lessons: new Set(
      rows.filter((r) => r.kind === 'lesson' || r.kind === 'test').map((r) => r.lesson_id),
    ),
    practice: new Set(rows.filter((r) => r.kind === 'practice').map((r) => r.lesson_id)),
    reviewed: rows.some((r) => r.kind === 'review'),
  };
}

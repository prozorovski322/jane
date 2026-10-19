/**
 * Merges two snapshots of the learner's data (this device and the account) so that neither side
 * loses progress: completed lessons, XP, review cards and achievements from both are kept, and
 * where both have the same thing the one with more progress wins. Merging is symmetric for
 * progress and idempotent: merging a snapshot with itself, or with an earlier merge result,
 * changes nothing. Settings (kv) of this device win over the account's.
 */
import type { Snapshot } from './backup';

type Row = Snapshot['tables'][keyof Snapshot['tables']][number];
type Tables = Snapshot['tables'];

const num = (v: Row[string] | undefined) => (typeof v === 'number' ? v : Number(v ?? 0));

/** Union by key; when both have a row, `pick` decides (default: the local one). */
function byKey(
  local: readonly Row[],
  remote: readonly Row[],
  key: (r: Row) => string,
  pick: (l: Row, r: Row) => Row = (l) => l,
): Row[] {
  const out = new Map<string, Row>();
  for (const r of remote) out.set(key(r), r);
  for (const l of local) {
    const k = key(l);
    const r = out.get(k);
    out.set(k, r ? pick(l, r) : l);
  }
  return [...out.values()];
}

/** Per column: the larger number, the earlier/later time, as each column needs. */
function combine(l: Row, r: Row, rules: Record<string, 'max' | 'min'>): Row {
  const out: Row = { ...r, ...l };
  for (const [col, rule] of Object.entries(rules)) {
    const a = num(l[col]);
    const b = num(r[col]);
    out[col] = rule === 'max' ? Math.max(a, b) : Math.min(a, b);
  }
  return out;
}

/**
 * Tables whose ids are autoincrement numbers: the same row has different ids on two devices.
 * Rows are matched by their content (`identity`) and numbered anew; `remap` returns, for each
 * side, its old id → new id, so that child rows can follow.
 */
function renumber(
  local: readonly Row[],
  remote: readonly Row[],
  identity: (r: Row) => string,
): { rows: Row[]; remap: { local: Map<number, number>; remote: Map<number, number> } } {
  const rows: Row[] = [];
  const byIdentity = new Map<string, number>();
  const remap = { local: new Map<number, number>(), remote: new Map<number, number>() };
  const add = (side: 'local' | 'remote', r: Row) => {
    const k = identity(r);
    let id = byIdentity.get(k);
    if (id === undefined) {
      id = rows.length + 1;
      byIdentity.set(k, id);
      rows.push({ ...r, id });
    }
    remap[side].set(num(r.id), id);
  };
  // Oldest first, so the numbering follows time on every device.
  const order = (rs: readonly Row[], side: 'local' | 'remote') => [...rs].map((r) => ({ r, side }));
  const all = [...order(remote, 'remote'), ...order(local, 'local')].sort((a, b) =>
    identity(a.r).localeCompare(identity(b.r)),
  );
  for (const { r, side } of all) add(side, r);
  return { rows, remap };
}

const pad = (v: Row[string] | undefined) => String(num(v)).padStart(15, '0');

export function mergeSnapshots(local: Snapshot, remote: Snapshot, now = new Date()): Snapshot {
  const L = local.tables;
  const R = remote.tables;
  const t = {} as Tables;

  // Settings and onboarding answers: this device's values win; the account fills what is missing.
  t.kv = byKey(L.kv, R.kv, (r) => String(r.key));

  // Sessions and the answers given in them.
  const results = renumber(
    L.lesson_results,
    R.lesson_results,
    (r) => `${pad(r.finished_at)}|${pad(r.started_at)}|${r.lesson_id}`,
  );
  t.lesson_results = results.rows;
  const attemptsOf = (rows: readonly Row[], map: Map<number, number>) =>
    rows
      .filter((a) => map.has(num(a.result_id)))
      .map((a) => ({ ...a, result_id: map.get(num(a.result_id))! }));
  const attempts = renumber(
    attemptsOf(L.attempts, results.remap.local),
    attemptsOf(R.attempts, results.remap.remote),
    (r) => `${pad(r.at)}|${r.exercise_id}|${pad(r.result_id)}`,
  );
  t.attempts = attempts.rows;

  t.lesson_progress = byKey(
    L.lesson_progress,
    R.lesson_progress,
    (r) => String(r.lesson_id),
    (l, r) => ({
      ...combine(l, r, {
        first_completed_at: 'min',
        last_completed_at: 'max',
        best_score: 'max',
        passed: 'max',
        times: 'max',
      }),
      // A lesson really completed beats one credited by the placement test.
      source:
        l.source === 'lesson' || r.source === 'lesson'
          ? 'lesson'
          : (l.source ?? r.source ?? 'lesson'),
    }),
  );

  t.daily_activity = byKey(
    L.daily_activity,
    R.daily_activity,
    (r) => String(r.day),
    (l, r) => combine(l, r, { xp: 'max', lessons: 'max', reviews: 'max', seconds: 'max' }),
  );
  t.streak_freezes = byKey(
    L.streak_freezes,
    R.streak_freezes,
    (r) => String(r.day),
    (l, r) => combine(l, r, { used_at: 'min' }),
  );

  // Review cards: the one reviewed last (then the one with more repetitions) is the current one.
  t.srs_cards = byKey(
    L.srs_cards,
    R.srs_cards,
    (r) => String(r.id),
    (l, r) => {
      const lr = num(l.last_review);
      const rr = num(r.last_review);
      if (lr !== rr) return lr > rr ? l : r;
      return num(l.reps) >= num(r.reps) ? l : r;
    },
  );
  const cards = new Set(t.srs_cards.map((c) => String(c.id)));
  t.srs_log = renumber(
    L.srs_log.filter((r) => cards.has(String(r.card_id))),
    R.srs_log.filter((r) => cards.has(String(r.card_id))),
    (r) => `${pad(r.reviewed_at)}|${r.card_id}|${r.rating}`,
  ).rows;

  t.favorites = byKey(
    L.favorites,
    R.favorites,
    (r) => String(r.word_id),
    (l, r) => combine(l, r, { added_at: 'min' }),
  );
  t.user_words = renumber(
    L.user_words,
    R.user_words,
    (r) => `${pad(r.created_at)}|${r.en}|${r.ru}`,
  ).rows;
  t.achievements = byKey(
    L.achievements,
    R.achievements,
    (r) => String(r.id),
    (l, r) => combine(l, r, { unlocked_at: 'min' }),
  );
  t.quest_log = byKey(
    L.quest_log,
    R.quest_log,
    (r) => `${r.day}|${r.quest_id}`,
    (l, r) => combine(l, r, { completed_at: 'min' }),
  );
  // Certificates: an exam result beats a placement credit; otherwise the better score.
  t.certificates = byKey(
    L.certificates,
    R.certificates,
    (r) => String(r.level),
    (l, r) => {
      if (l.source !== r.source) return l.source === 'exam' ? l : r;
      return num(l.score) >= num(r.score) ? l : r;
    },
  );

  return {
    app: 'jane',
    schema: Math.max(local.schema, remote.schema),
    exportedAt: now.toISOString(),
    tables: t,
  };
}

/** Whether two snapshots hold the same data (ignoring when they were taken). */
export function sameData(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}

function normalized(s: Snapshot) {
  return Object.fromEntries(
    Object.entries(s.tables).map(([name, rows]) => [
      name,
      rows
        .map((r) =>
          JSON.stringify(
            Object.fromEntries(Object.entries(r).sort(([x], [y]) => x.localeCompare(y))),
          ),
        )
        .sort(),
    ]),
  );
}

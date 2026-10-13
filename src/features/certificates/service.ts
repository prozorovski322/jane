/**
 * Level certificates. The learner earns one by passing the level exam; passing the placement
 * test credits the levels below the result without a certificate-worthy score. Certificates only
 * open optional branches (tracks) and mark achievements: levels themselves are never locked.
 */
import { LEVELS, type Level } from '@/core/content/schema';
import type { Db } from '@/core/storage/db';

export type CertificateSource = 'exam' | 'placement';

export interface Certificate {
  level: Level;
  earnedAt: number;
  /** Exam score 0..1 (0 for levels credited by the placement test). */
  score: number;
  source: CertificateSource;
}

/** Saves an exam certificate; a better result or an exam over a placement credit replaces it. */
export async function awardExamCertificate(
  db: Db,
  level: Level,
  score: number,
  now: Date,
): Promise<void> {
  await db.run(
    `INSERT INTO certificates (level, earned_at, score, source) VALUES (?, ?, ?, 'exam')
     ON CONFLICT (level) DO UPDATE SET
       earned_at = CASE WHEN source = 'exam' THEN earned_at ELSE excluded.earned_at END,
       score = CASE WHEN source = 'exam' THEN MAX(score, excluded.score) ELSE excluded.score END,
       source = 'exam'`,
    [level, now.getTime(), score],
  );
}

/** Credits every level below `level` (the placement result); never overwrites an exam. */
export async function creditLevelsBelow(db: Db, level: Level, now: Date): Promise<void> {
  for (const below of LEVELS.slice(0, LEVELS.indexOf(level))) {
    await db.run(
      `INSERT INTO certificates (level, earned_at, score, source) VALUES (?, ?, 0, 'placement')
       ON CONFLICT (level) DO NOTHING`,
      [below, now.getTime()],
    );
  }
}

export async function loadCertificates(db: Db): Promise<Certificate[]> {
  const rows = await db.all<{ level: Level; earned_at: number; score: number; source: string }>(
    'SELECT level, earned_at, score, source FROM certificates',
  );
  return rows
    .map((r) => ({
      level: r.level,
      earnedAt: r.earned_at,
      score: r.score,
      source: r.source as CertificateSource,
    }))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}

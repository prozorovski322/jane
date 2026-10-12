/**
 * Local checker for short written answers: word count, content criteria, typical mistakes.
 * Works fully offline; an optional AI review can be layered on top of its result.
 */
import { countWords } from '../content/lexical';
import type { ExerciseOf } from '../content/schema';
import { compilePattern, matchesAny, normalizeFreeText } from './patterns';

export interface WritingResult {
  wordCount: number;
  tooShort: boolean;
  tooLong: boolean;
  criteria: { id: string; label: string; required: boolean; met: boolean }[];
  mistakes: { message: string; fragment: string }[];
  /** 0..1: share of required criteria met, minus a penalty for length and mistakes. */
  score: number;
  passed: boolean;
}

export function checkWriting(text: string, ex: ExerciseOf<'write'>): WritingResult {
  const wordCount = countWords(text);
  const tooShort = wordCount < ex.minWords;
  const tooLong = wordCount > ex.maxWords;

  const criteria = ex.criteria.map((c) => ({
    id: c.id,
    label: c.label,
    required: c.required,
    met: matchesAny(text, c.patterns),
  }));

  const normalized = normalizeFreeText(text);
  const mistakes: WritingResult['mistakes'] = [];
  for (const e of ex.commonErrors) {
    const m = compilePattern(e.pattern).exec(normalized);
    if (m) mistakes.push({ message: e.message, fragment: m[0] });
  }

  const required = criteria.filter((c) => c.required);
  const metShare = required.length ? required.filter((c) => c.met).length / required.length : 1;
  const penalty = (tooShort ? 0.3 : 0) + (tooLong ? 0.1 : 0) + Math.min(0.3, mistakes.length * 0.1);
  const score = Math.max(0, Math.min(1, metShare - penalty));

  return {
    wordCount,
    tooShort,
    tooLong,
    criteria,
    mistakes,
    score,
    passed: !tooShort && required.every((c) => c.met) && mistakes.length === 0,
  };
}

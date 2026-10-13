import { editDistance } from './distance';
import { canonicalTokens } from './normalize';

function sameWord(a: string, b: string): boolean {
  return a === b || (b.length >= 5 && editDistance(a, b) <= 1);
}

function lcsTable(a: string[], b: string[]): number[][] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = sameWord(a[i - 1]!, b[j - 1]!)
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp;
}

/**
 * Share of the target's words that appear, in order, in what the learner said (longest common
 * subsequence). Speech recognizers drop or mishear short words, so this is deliberately lenient.
 */
export function speechSimilarity(said: string, target: string): number {
  const a = canonicalTokens(said, 'en');
  const b = canonicalTokens(target, 'en');
  if (!b.length) return 0;
  return lcsTable(a, b)[a.length]![b.length]! / b.length;
}

/** Words of the target that were not heard (for "you missed: …" feedback). */
export function missingWords(said: string, target: string): string[] {
  const a = canonicalTokens(said, 'en');
  const b = canonicalTokens(target, 'en');
  const dp = lcsTable(a, b);
  const missing: string[] = [];
  let i = a.length;
  let j = b.length;
  while (j > 0) {
    if (i > 0 && sameWord(a[i - 1]!, b[j - 1]!) && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      i--;
      j--;
    } else if (i > 0 && dp[i - 1]![j] === dp[i]![j]) {
      i--;
    } else {
      missing.unshift(b[j - 1]!);
      j--;
    }
  }
  return missing;
}

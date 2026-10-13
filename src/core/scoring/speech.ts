import { editDistance } from './distance';
import { canonicalTokens } from './normalize';

function sameWord(a: string, b: string): boolean {
  return a === b || (b.length >= 5 && editDistance(a, b) <= 1);
}

/**
 * Share of the target's words that appear, in order, in what the learner said (longest common
 * subsequence). Speech recognizers drop or mishear short words, so this is deliberately lenient.
 */
export function speechSimilarity(said: string, target: string): number {
  const a = canonicalTokens(said, 'en');
  const b = canonicalTokens(target, 'en');
  if (!b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = sameWord(a[i - 1]!, b[j - 1]!)
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp[a.length]![b.length]! / b.length;
}

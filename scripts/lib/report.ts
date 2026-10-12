import type { Issue } from './load';

/** Prints issues grouped by file; returns the number of errors. */
export function printIssues(issues: readonly Issue[], { quiet = false } = {}): number {
  const byFile = new Map<string, Issue[]>();
  for (const i of issues) {
    const list = byFile.get(i.file) ?? [];
    list.push(i);
    byFile.set(i.file, list);
  }
  for (const [file, list] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    const shown = quiet ? list.filter((i) => i.severity === 'error') : list;
    if (!shown.length) continue;
    console.log(`\n${file || '(content)'}`);
    for (const i of shown) {
      const mark = i.severity === 'error' ? 'ERROR' : 'warn ';
      console.log(`  ${mark} ${i.path ? i.path + ': ' : ''}${i.message}`);
    }
  }
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  console.log(`\n${errors} error(s), ${warnings} warning(s)`);
  return errors;
}

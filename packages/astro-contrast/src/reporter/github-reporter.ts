import { relative } from 'node:path';
import type { FileAnalysisResult } from '../types/index.js';

export function emitGitHubAnnotations(
  fileResults: FileAnalysisResult[],
  options: { level?: 'aa' | 'aaa' } = {},
): void {
  const level = options.level ?? 'aa';

  for (const file of fileResults) {
    const relPath = relative(process.cwd(), file.filePath);

    for (const result of file.results) {
      const isFailing = level === 'aaa' ? !result.meetsAAA : !result.meetsAA;
      if (!isFailing) continue;

      const severity = !result.meetsAA ? 'error' : 'warning';
      const aaReq = result.isLargeText ? '3:1' : '4.5:1';
      const aaaReq = result.isLargeText ? '4.5:1' : '7:1';
      const req = !result.meetsAA ? `AA (requires ${aaReq})` : `AAA (requires ${aaaReq})`;
      const selector = result.foreground.selector;
      const msg = `Contrast ${result.ratio.toFixed(1)}:1 fails ${req} — ${result.foreground.original} on ${result.background.original} (${selector})`;

      console.log(`::${severity} file=${relPath},line=${result.element.position.line},col=${result.element.position.column}::${msg}`);
    }
  }
}

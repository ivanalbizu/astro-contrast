import pc from 'picocolors';
import type { FileAnalysisResult, ContrastResult, AnalysisError } from '../types/index.js';

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}

function formatResult(result: ContrastResult): string {
  const tag = result.meetsAAA
    ? pc.green(pc.bold(' PASS '))
    : result.meetsAA
      ? pc.yellow(pc.bold(' AA   '))
      : pc.red(pc.bold(' FAIL '));

  const selector = pc.dim(
    result.foreground.selector !== result.background.selector
      ? result.foreground.selector
      : result.foreground.selector,
  );

  const colors = `${result.foreground.original} ${pc.dim('on')} ${result.background.original}`;
  const ratio = result.meetsAA
    ? pc.green(formatRatio(result.ratio))
    : pc.red(formatRatio(result.ratio));

  const largeTag = result.isLargeText ? pc.dim(' [large]') : '';

  let wcag = '';
  if (result.meetsAAA) {
    wcag = pc.green('AA \u2713  AAA \u2713');
  } else if (result.meetsAA) {
    wcag = pc.yellow('AA \u2713  AAA \u2717');
  } else {
    const aaReq = result.isLargeText ? '3:1' : '4.5:1';
    wcag = pc.red(`AA requires ${aaReq}`);
  }

  const pos = pc.dim(`L${result.element.position.line}`);

  return `  ${tag} ${selector}  ${pos}  ${colors}  \u2192  ${ratio}  (${wcag})${largeTag}`;
}

function formatError(error: AnalysisError): string {
  const tag = pc.yellow(pc.bold(' WARN '));
  const pos = error.element ? pc.dim(`L${error.element.position.line}`) : '';
  return `  ${tag} ${pos}  ${error.message}`;
}

export function reportResults(
  fileResults: FileAnalysisResult[],
  options: { verbose?: boolean; level?: 'aa' | 'aaa' } = {},
): void {
  const { verbose = false, level = 'aa' } = options;

  console.log();

  let totalPairs = 0;
  let totalPassing = 0;
  let totalFailing = 0;
  let totalWarnings = 0;

  for (const file of fileResults) {
    console.log(pc.cyan(pc.bold(file.filePath)));

    // Show results
    for (const result of file.results) {
      const isFailing = level === 'aaa' ? !result.meetsAAA : !result.meetsAA;

      if (verbose || isFailing) {
        console.log(formatResult(result));
      }

      if (isFailing) {
        totalFailing++;
      } else {
        totalPassing++;
      }
    }

    // Show warnings/errors
    for (const error of file.errors) {
      console.log(formatError(error));
      totalWarnings++;
    }

    totalPairs += file.stats.pairsChecked;

    if (file.results.length === 0 && file.errors.length === 0) {
      console.log(pc.dim('  No color pairs to analyze'));
    }

    console.log();
  }

  // Summary
  console.log(pc.bold('Summary:'));
  console.log(`  Files analyzed: ${fileResults.length}`);
  console.log(`  Color pairs checked: ${totalPairs}`);

  if (totalFailing > 0) {
    console.log(`  ${pc.green(`Passing: ${totalPassing}`)} | ${pc.red(`Failing: ${totalFailing}`)}${totalWarnings > 0 ? ` | ${pc.yellow(`Warnings: ${totalWarnings}`)}` : ''}`);
  } else if (totalPairs > 0) {
    console.log(`  ${pc.green(`All ${totalPassing} pairs pass ${level.toUpperCase()}!`)}`);
  }

  console.log();
}

import { dirname } from 'node:path';
import { parseAstroFile } from './parser/astro-parser.js';
import { resolveDeclarationValues } from './resolver/custom-properties.js';
import { resolveLinkedCss } from './resolver/css-auto-resolver.js';
import { buildColorPairs } from './matcher/selector-matcher.js';
import { evaluateContrast } from './contrast/wcag.js';
import type { FileAnalysisResult, ContrastResult, AnalysisError, CssRuleInfo, IgnoreConfig } from './types/index.js';
import { applyIgnoreFilter } from './matcher/ignore-filter.js';

export interface AnalyzeOptions {
  /** External token values to merge with in-file custom properties */
  externalTokens?: Map<string, string>;
  /** CSS rules from external files (lower priority than in-file rules) */
  externalCssRules?: CssRuleInfo[];
  /** Custom properties from external CSS files */
  externalCustomProperties?: Map<string, string>;
  /** Global ignore rules — colors, pairs, and/or selectors to exclude from results */
  ignore?: IgnoreConfig;
}

export async function analyzeFile(
  filePath: string,
  options: AnalyzeOptions = {},
): Promise<FileAnalysisResult> {
  const errors: AnalysisError[] = [];
  const results: ContrastResult[] = [];

  let parsed;
  try {
    parsed = await parseAstroFile(filePath);
  } catch (err) {
    return {
      filePath,
      results: [],
      errors: [{
        message: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`,
        type: 'parse-error',
      }],
      stats: { elementsAnalyzed: 0, pairsChecked: 0, passing: 0, aaFailing: 0, aaaOnlyFailing: 0, unresolvable: 0 },
    };
  }

  // Auto-detect CSS from <link rel="stylesheet"> and @import in <style>
  const autoDetectedCss = await resolveLinkedCss(
    [...parsed.linkedCssHrefs, ...parsed.styleImports],
    dirname(filePath),
  );

  // Merge custom properties: tokens < auto-detected < external CSS < in-file :root (highest priority)
  const allProperties = new Map<string, string>();
  if (options.externalTokens) {
    for (const [k, v] of options.externalTokens) {
      allProperties.set(k, v);
    }
  }
  for (const [k, v] of autoDetectedCss.customProperties) {
    allProperties.set(k, v);
  }
  if (options.externalCustomProperties) {
    for (const [k, v] of options.externalCustomProperties) {
      allProperties.set(k, v);
    }
  }
  for (const [k, v] of parsed.customProperties) {
    allProperties.set(k, v);
  }

  // Merge CSS rules: auto-detected < manual --css < in-file (highest priority)
  const allRules = [
    ...autoDetectedCss.rules,
    ...(options.externalCssRules ?? []),
    ...parsed.styleRules,
  ];

  // Resolve custom properties in declarations
  resolveDeclarationValues(allRules, allProperties);

  // Build color pairs
  const pairs = buildColorPairs(parsed.htmlNodes, allRules);

  let unresolvable = 0;

  for (const pair of pairs) {
    if (!pair.foreground.rgb || !pair.background.rgb) {
      unresolvable++;
      errors.push({
        message: `Could not resolve color: fg=${pair.foreground.original}, bg=${pair.background.original}`,
        element: pair.element,
        type: 'color-resolve-error',
      });
      continue;
    }

    const evaluation = evaluateContrast(pair.foreground.rgb, pair.background.rgb, {
      fontSize: pair.fontSize,
      fontWeight: pair.fontWeight,
    });

    results.push({
      filePath,
      element: pair.element,
      foreground: pair.foreground,
      background: pair.background,
      ratio: evaluation.ratio,
      meetsAA: evaluation.meetsAA,
      meetsAAA: evaluation.meetsAAA,
      level: evaluation.level,
      isLargeText: evaluation.isLargeText,
    });
  }

  // Apply global ignore filter
  const filteredResults = applyIgnoreFilter(results, options.ignore);

  const passing = filteredResults.filter(r => r.meetsAA).length;
  const aaFailing = filteredResults.filter(r => !r.meetsAA).length;
  const aaaOnlyFailing = filteredResults.filter(r => r.meetsAA && !r.meetsAAA).length;

  return {
    filePath,
    results: filteredResults,
    errors,
    stats: {
      elementsAnalyzed: parsed.htmlNodes.length,
      pairsChecked: filteredResults.length,
      passing,
      aaFailing,
      aaaOnlyFailing,
      unresolvable,
    },
  };
}

export async function analyzeFiles(
  filePaths: string[],
  options: AnalyzeOptions = {},
): Promise<FileAnalysisResult[]> {
  const results: FileAnalysisResult[] = [];
  for (const filePath of filePaths) {
    results.push(await analyzeFile(filePath, options));
  }
  return results;
}

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { analyzeFile } from '../src/analyzer.js';
import { parseCssBlock } from '../src/parser/css-parser.js';
import type { CssRuleInfo, ContrastResult } from '../src/types/index.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

async function loadExternalCss(paths: string[]): Promise<{ rules: CssRuleInfo[]; customProperties: Map<string, string> }> {
  const allRules: CssRuleInfo[] = [];
  const allProperties = new Map<string, string>();

  for (const cssPath of paths) {
    const content = await readFile(cssPath, 'utf-8');
    const { rules, customProperties } = parseCssBlock(content);
    allRules.push(...rules);
    for (const [k, v] of customProperties) {
      allProperties.set(k, v);
    }
  }

  return { rules: allRules, customProperties: allProperties };
}

function findByClass(results: ContrastResult[], cls: string): ContrastResult | undefined {
  return results.find(r => r.element.classes.includes(cls));
}

describe('external CSS support', () => {
  const astroFile = join(FIXTURES, 'external-css.astro');
  const externalCssFile = join(FIXTURES, 'external.css');
  const overridesCssFile = join(FIXTURES, 'external-overrides.css');

  it('applies external CSS rules to .astro elements', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    const externalText = findByClass(result.results, 'external-text');
    expect(externalText).toBeDefined();
    expect(externalText!.ratio).toBeGreaterThan(1);
  });

  it('resolves var() references using external custom properties', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    const varEl = findByClass(result.results, 'var-from-external');
    expect(varEl).toBeDefined();
    expect(varEl!.foreground.rgb).toBeTruthy();
    expect(varEl!.background.rgb).toBeTruthy();
  });

  it('external custom properties resolve in in-file <style> var() references', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCustomProperties: css.customProperties,
    });

    // .var-from-external uses var(--external-primary) and var(--external-bg) defined in external CSS
    const varEl = findByClass(result.results, 'var-from-external');
    expect(varEl).toBeDefined();
    expect(varEl!.foreground.rgb).toBeTruthy();
    expect(varEl!.background.rgb).toBeTruthy();
  });

  it('in-file CSS rules take priority over external rules at same specificity', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    // .local-text has color #333333 from in-file CSS
    const localText = findByClass(result.results, 'local-text');
    expect(localText).toBeDefined();
    // #333333 on #ffffff = high contrast
    expect(localText!.meetsAA).toBe(true);
  });

  it('detects failing contrast from external CSS', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    // .external-subtle has #999999 on #ffffff — fails AA (ratio ~2.85)
    const subtle = findByClass(result.results, 'external-subtle');
    expect(subtle).toBeDefined();
    expect(subtle!.meetsAA).toBe(false);
  });

  it('multiple external CSS files merge (later overrides earlier)', async () => {
    const css = await loadExternalCss([externalCssFile, overridesCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    // .external-text: overrides.css redefines color to #0d3b66
    const externalText = findByClass(result.results, 'external-text');
    expect(externalText).toBeDefined();
    expect(externalText!.foreground.rgb).toBeTruthy();
  });

  it('works without external CSS (no regressions)', async () => {
    const result = await analyzeFile(astroFile);

    // .local-text and .override-text come from in-file <style>
    const localText = findByClass(result.results, 'local-text');
    expect(localText).toBeDefined();
    expect(localText!.meetsAA).toBe(true);
  });

  it('returns correct stats', async () => {
    const css = await loadExternalCss([externalCssFile]);
    const result = await analyzeFile(astroFile, {
      externalCssRules: css.rules,
      externalCustomProperties: css.customProperties,
    });

    expect(result.stats.pairsChecked).toBeGreaterThanOrEqual(5);
    expect(result.stats.aaFailing).toBeGreaterThanOrEqual(1); // .external-subtle fails
  });
});

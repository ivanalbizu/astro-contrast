import { describe, it, expect } from 'vitest';
import { analyzeFile } from '../src/analyzer.js';
import { parseIgnoreConfig, shouldIgnoreResult, applyIgnoreFilter } from '../src/matcher/ignore-filter.js';
import type { ContrastResult, HtmlElementInfo, ColorInfo, RgbColor } from '../src/types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeElement(overrides: Partial<HtmlElementInfo> = {}): HtmlElementInfo {
  return {
    tagName: 'p',
    classes: [],
    id: null,
    inlineStyles: null,
    position: { line: 1, column: 1 },
    hasTextContent: true,
    ignored: false,
    ...overrides,
  };
}

function makeColorInfo(rgb: RgbColor, original = '#000000'): ColorInfo {
  return { original, rgb, source: 'inline', selector: 'inline' };
}

function makeResult(overrides: {
  fgRgb?: RgbColor;
  bgRgb?: RgbColor;
  classes?: string[];
  tagName?: string;
  id?: string | null;
} = {}): ContrastResult {
  return {
    filePath: 'test.astro',
    element: makeElement({
      tagName: overrides.tagName ?? 'p',
      classes: overrides.classes ?? [],
      id: overrides.id ?? null,
    }),
    foreground: makeColorInfo(overrides.fgRgb ?? { r: 255, g: 255, b: 255 }, '#ffffff'),
    background: makeColorInfo(overrides.bgRgb ?? { r: 231, g: 76, b: 60 }, '#e74c3c'),
    ratio: 3.9,
    meetsAA: false,
    meetsAAA: false,
    level: 'aa-fail',
    isLargeText: false,
  };
}

// ── Unit tests: parseIgnoreConfig ────────────────────────────────────

describe('parseIgnoreConfig', () => {
  it('returns null for undefined', () => {
    expect(parseIgnoreConfig(undefined)).toBeNull();
  });

  it('returns null for empty config', () => {
    expect(parseIgnoreConfig({ colors: [], pairs: [], selectors: [] })).toBeNull();
  });

  it('returns null for invalid colors only', () => {
    expect(parseIgnoreConfig({ colors: ['not-a-color', 'also-invalid'] })).toBeNull();
  });

  it('returns config for valid colors', () => {
    const parsed = parseIgnoreConfig({ colors: ['#e74c3c'] });
    expect(parsed).not.toBeNull();
    expect(parsed!.colors).toHaveLength(1);
    expect(parsed!.colors[0]).toEqual({ r: 231, g: 76, b: 60 });
  });
});

// ── Unit tests: color ignores ────────────────────────────────────────

describe('color ignores', () => {
  it('ignores result with matching foreground color', () => {
    const parsed = parseIgnoreConfig({ colors: ['#ffffff'] })!;
    const result = makeResult({ fgRgb: { r: 255, g: 255, b: 255 } });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('ignores result with matching background color', () => {
    const parsed = parseIgnoreConfig({ colors: ['#e74c3c'] })!;
    const result = makeResult({ bgRgb: { r: 231, g: 76, b: 60 } });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('matches same color in different format (rgb vs hex)', () => {
    const parsed = parseIgnoreConfig({ colors: ['rgb(231, 76, 60)'] })!;
    const result = makeResult({ bgRgb: { r: 231, g: 76, b: 60 } });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('matches named colors', () => {
    const parsed = parseIgnoreConfig({ colors: ['red'] })!;
    const result = makeResult({ fgRgb: { r: 255, g: 0, b: 0 } });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('does not ignore non-matching color', () => {
    const parsed = parseIgnoreConfig({ colors: ['#e74c3c'] })!;
    const result = makeResult({ fgRgb: { r: 51, g: 51, b: 51 }, bgRgb: { r: 255, g: 255, b: 255 } });
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });

  it('alpha mismatch does not match', () => {
    const parsed = parseIgnoreConfig({ colors: ['rgba(0, 0, 0, 0.5)'] })!;
    const result = makeResult({ fgRgb: { r: 0, g: 0, b: 0 } }); // no alpha = opaque
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });
});

// ── Unit tests: pair ignores ─────────────────────────────────────────

describe('pair ignores', () => {
  it('ignores exact foreground+background pair', () => {
    const parsed = parseIgnoreConfig({
      pairs: [{ foreground: '#ffffff', background: '#e74c3c' }],
    })!;
    const result = makeResult({
      fgRgb: { r: 255, g: 255, b: 255 },
      bgRgb: { r: 231, g: 76, b: 60 },
    });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('does not ignore reversed pair', () => {
    const parsed = parseIgnoreConfig({
      pairs: [{ foreground: '#e74c3c', background: '#ffffff' }],
    })!;
    const result = makeResult({
      fgRgb: { r: 255, g: 255, b: 255 },
      bgRgb: { r: 231, g: 76, b: 60 },
    });
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });

  it('does not ignore partial match (only fg matches)', () => {
    const parsed = parseIgnoreConfig({
      pairs: [{ foreground: '#ffffff', background: '#000000' }],
    })!;
    const result = makeResult({
      fgRgb: { r: 255, g: 255, b: 255 },
      bgRgb: { r: 231, g: 76, b: 60 },
    });
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });
});

// ── Unit tests: selector ignores ─────────────────────────────────────

describe('selector ignores', () => {
  it('matches class selector', () => {
    const parsed = parseIgnoreConfig({ selectors: ['.brand-badge'] })!;
    const result = makeResult({ classes: ['brand-badge'] });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('does not match different class', () => {
    const parsed = parseIgnoreConfig({ selectors: ['.brand-badge'] })!;
    const result = makeResult({ classes: ['other-class'] });
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });

  it('matches ID selector', () => {
    const parsed = parseIgnoreConfig({ selectors: ['#logo'] })!;
    const result = makeResult({ id: 'logo' });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('matches tag selector', () => {
    const parsed = parseIgnoreConfig({ selectors: ['span'] })!;
    const result = makeResult({ tagName: 'span' });
    expect(shouldIgnoreResult(result, parsed)).toBe(true);
  });

  it('does not match different tag', () => {
    const parsed = parseIgnoreConfig({ selectors: ['span'] })!;
    const result = makeResult({ tagName: 'p' });
    expect(shouldIgnoreResult(result, parsed)).toBe(false);
  });

  it('wildcard class matches prefix', () => {
    const parsed = parseIgnoreConfig({ selectors: ['.alert-*'] })!;
    expect(shouldIgnoreResult(makeResult({ classes: ['alert-danger'] }), parsed)).toBe(true);
    expect(shouldIgnoreResult(makeResult({ classes: ['alert-warning'] }), parsed)).toBe(true);
    expect(shouldIgnoreResult(makeResult({ classes: ['alert-'] }), parsed)).toBe(true);
  });

  it('wildcard does not match unrelated', () => {
    const parsed = parseIgnoreConfig({ selectors: ['.alert-*'] })!;
    expect(shouldIgnoreResult(makeResult({ classes: ['notification'] }), parsed)).toBe(false);
  });

  it('wildcard ID matches', () => {
    const parsed = parseIgnoreConfig({ selectors: ['#nav-*'] })!;
    expect(shouldIgnoreResult(makeResult({ id: 'nav-main' }), parsed)).toBe(true);
    expect(shouldIgnoreResult(makeResult({ id: 'footer' }), parsed)).toBe(false);
  });
});

// ── Unit tests: applyIgnoreFilter ────────────────────────────────────

describe('applyIgnoreFilter', () => {
  it('returns all results when config is undefined', () => {
    const results = [makeResult(), makeResult()];
    expect(applyIgnoreFilter(results, undefined)).toHaveLength(2);
  });

  it('filters matching results', () => {
    const results = [
      makeResult({ classes: ['brand-badge'] }),
      makeResult({ classes: ['normal-text'] }),
    ];
    const filtered = applyIgnoreFilter(results, { selectors: ['.brand-badge'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].element.classes).toContain('normal-text');
  });
});

// ── Integration tests ────────────────────────────────────────────────

describe('global ignore integration', () => {
  const fixture = 'packages/astro-contrast/tests/fixtures/global-ignore.astro';

  it('without ignore returns all 5 elements', async () => {
    const result = await analyzeFile(fixture);
    expect(result.results).toHaveLength(5);
  });

  it('ignore color excludes all elements using that color', async () => {
    const result = await analyzeFile(fixture, {
      ignore: { colors: ['#e74c3c'] },
    });
    // #e74c3c appears in badge (bg), alert-danger does NOT use #e74c3c, logo (bg)
    // So brand-badge and logo should be filtered
    const remaining = result.results.map(r => r.element.classes[0] ?? r.element.id ?? r.element.tagName);
    expect(remaining).not.toContain('brand-badge');
    expect(remaining).not.toContain('logo');
    expect(result.results.length).toBeLessThan(5);
  });

  it('ignore selector excludes matching elements', async () => {
    const result = await analyzeFile(fixture, {
      ignore: { selectors: ['.brand-badge'] },
    });
    const classes = result.results.flatMap(r => r.element.classes);
    expect(classes).not.toContain('brand-badge');
    expect(result.results).toHaveLength(4);
  });

  it('ignore wildcard selector', async () => {
    const result = await analyzeFile(fixture, {
      ignore: { selectors: ['.alert-*'] },
    });
    const classes = result.results.flatMap(r => r.element.classes);
    expect(classes).not.toContain('alert-danger');
    expect(result.results).toHaveLength(4);
  });

  it('ignore pair excludes only exact pair', async () => {
    const result = await analyzeFile(fixture, {
      ignore: { pairs: [{ foreground: '#ffffff', background: '#e74c3c' }] },
    });
    // brand-badge and logo use #fff on #e74c3c
    const remaining = result.results.map(r => r.element.classes[0] ?? r.element.id ?? r.element.tagName);
    expect(remaining).not.toContain('brand-badge');
    expect(remaining).toContain('alert-danger'); // uses #cc0000, not #e74c3c
  });

  it('stats reflect filtered results', async () => {
    const withoutIgnore = await analyzeFile(fixture);
    const withIgnore = await analyzeFile(fixture, {
      ignore: { selectors: ['.brand-badge', '.alert-*'] },
    });
    expect(withIgnore.stats.pairsChecked).toBeLessThan(withoutIgnore.stats.pairsChecked);
  });

  it('combined ignore types work together', async () => {
    const result = await analyzeFile(fixture, {
      ignore: {
        colors: ['#cc0000'],       // filters alert-danger
        selectors: ['.brand-badge'], // filters brand-badge
      },
    });
    const remaining = result.results.map(r => r.element.classes[0] ?? r.element.id ?? r.element.tagName);
    expect(remaining).not.toContain('brand-badge');
    expect(remaining).not.toContain('alert-danger');
  });
});

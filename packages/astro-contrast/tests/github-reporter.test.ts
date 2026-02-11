import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { emitGitHubAnnotations } from '../src/reporter/github-reporter.js';
import type { FileAnalysisResult, ContrastResult, HtmlElementInfo, ColorInfo } from '../src/types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeElement(overrides: Partial<HtmlElementInfo> = {}): HtmlElementInfo {
  return {
    tagName: 'p',
    classes: [],
    id: null,
    inlineStyles: null,
    position: { line: 5, column: 3 },
    hasTextContent: true,
    ignored: false,
    ...overrides,
  };
}

function makeColor(original: string, selector: string): ColorInfo {
  return {
    original,
    rgb: { r: 0, g: 0, b: 0 },
    source: 'stylesheet',
    selector,
  };
}

function makeResult(overrides: Partial<ContrastResult> = {}): ContrastResult {
  return {
    filePath: join(process.cwd(), 'src/components/Card.astro'),
    element: makeElement(),
    foreground: makeColor('#999999', '.card-meta'),
    background: makeColor('#ffffff', '.card-meta'),
    ratio: 2.8,
    meetsAA: false,
    meetsAAA: false,
    level: 'aa-fail',
    isLargeText: false,
    ...overrides,
  };
}

function makeFileResult(results: ContrastResult[]): FileAnalysisResult {
  return {
    filePath: results[0]?.filePath ?? join(process.cwd(), 'src/test.astro'),
    results,
    errors: [],
    stats: {
      elementsAnalyzed: results.length,
      pairsChecked: results.length,
      passing: results.filter(r => r.meetsAA).length,
      aaFailing: results.filter(r => !r.meetsAA).length,
      aaaOnlyFailing: results.filter(r => r.meetsAA && !r.meetsAAA).length,
      unresolvable: 0,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('emitGitHubAnnotations', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits ::error for AA fail', () => {
    const result = makeResult({ ratio: 2.8, meetsAA: false, meetsAAA: false });
    emitGitHubAnnotations([makeFileResult([result])]);

    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toMatch(/^::error file=.*Card\.astro,line=5,col=3::/);
    expect(output).toContain('Contrast 2.8:1 fails AA (requires 4.5:1)');
    expect(output).toContain('#999999 on #ffffff');
    expect(output).toContain('.card-meta');
  });

  it('does not emit anything for passing pairs', () => {
    const result = makeResult({ ratio: 8.5, meetsAA: true, meetsAAA: true, level: 'pass' });
    emitGitHubAnnotations([makeFileResult([result])]);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not emit for AAA-only fail when level is aa', () => {
    const result = makeResult({ ratio: 5.2, meetsAA: true, meetsAAA: false, level: 'aaa-only' });
    emitGitHubAnnotations([makeFileResult([result])], { level: 'aa' });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('emits ::warning for AAA-only fail when level is aaa', () => {
    const result = makeResult({
      ratio: 5.2,
      meetsAA: true,
      meetsAAA: false,
      level: 'aaa-only',
      foreground: makeColor('#555555', '.card-body'),
      background: makeColor('#ffffff', '.card-body'),
    });
    emitGitHubAnnotations([makeFileResult([result])], { level: 'aaa' });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toMatch(/^::warning /);
    expect(output).toContain('AAA (requires 7:1)');
  });

  it('emits ::error for AA fail when level is aaa', () => {
    const result = makeResult({ ratio: 2.8, meetsAA: false, meetsAAA: false });
    emitGitHubAnnotations([makeFileResult([result])], { level: 'aaa' });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toMatch(/^::error /);
    expect(output).toContain('AA (requires 4.5:1)');
  });

  it('uses lower thresholds for large text in message', () => {
    const result = makeResult({
      ratio: 2.5,
      meetsAA: false,
      meetsAAA: false,
      isLargeText: true,
    });
    emitGitHubAnnotations([makeFileResult([result])]);

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('AA (requires 3:1)');
  });

  it('uses relative file path', () => {
    const result = makeResult({
      filePath: join(process.cwd(), 'src/components/Button.astro'),
    });
    emitGitHubAnnotations([makeFileResult([result])]);

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('file=src/components/Button.astro,');
  });

  it('emits multiple annotations for multiple failures', () => {
    const fail1 = makeResult({ ratio: 2.8, meetsAA: false, meetsAAA: false });
    const fail2 = makeResult({
      ratio: 1.5,
      meetsAA: false,
      meetsAAA: false,
      element: makeElement({ position: { line: 10, column: 5 } }),
      foreground: makeColor('#cccccc', '.subtle'),
    });
    const pass = makeResult({ ratio: 12.0, meetsAA: true, meetsAAA: true, level: 'pass' });

    emitGitHubAnnotations([makeFileResult([fail1, fail2, pass])]);

    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it('handles multiple files', () => {
    const file1Result = makeResult({
      filePath: join(process.cwd(), 'src/A.astro'),
      ratio: 2.0,
      meetsAA: false,
    });
    const file2Result = makeResult({
      filePath: join(process.cwd(), 'src/B.astro'),
      ratio: 1.5,
      meetsAA: false,
    });

    emitGitHubAnnotations([
      makeFileResult([file1Result]),
      makeFileResult([file2Result]),
    ]);

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect((logSpy.mock.calls[0][0] as string)).toContain('file=src/A.astro');
    expect((logSpy.mock.calls[1][0] as string)).toContain('file=src/B.astro');
  });
});

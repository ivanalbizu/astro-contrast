import { describe, it, expect } from 'vitest';
import { generateDashboardHtml } from '../src/reporter/html-reporter.js';
import type { FileAnalysisResult } from '../src/types/index.js';

function makeResult(overrides: Partial<FileAnalysisResult['results'][0]> = {}): FileAnalysisResult['results'][0] {
  return {
    filePath: '/project/src/pages/index.astro',
    element: {
      tagName: 'p',
      classes: [],
      id: null,
      inlineStyles: null,
      position: { line: 5, column: 3 },
      hasTextContent: true,
      ignored: false,
    },
    foreground: { original: '#999999', rgb: { r: 153, g: 153, b: 153 }, source: 'stylesheet', selector: '.text' },
    background: { original: '#ffffff', rgb: { r: 255, g: 255, b: 255 }, source: 'stylesheet', selector: '(default)' },
    ratio: 2.8,
    meetsAA: false,
    meetsAAA: false,
    level: 'aa-fail',
    isLargeText: false,
    ...overrides,
  };
}

function makeFileResult(overrides: Partial<FileAnalysisResult> = {}): FileAnalysisResult {
  return {
    filePath: '/project/src/pages/index.astro',
    results: [makeResult()],
    errors: [],
    stats: { elementsAnalyzed: 1, pairsChecked: 1, passing: 0, aaFailing: 1, aaaOnlyFailing: 0, unresolvable: 0 },
    ...overrides,
  };
}

describe('generateDashboardHtml', () => {
  it('generates valid HTML structure', () => {
    const html = generateDashboardHtml([makeFileResult()], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('astro-contrast');
  });

  it('shows failing results with FAIL tag', () => {
    const html = generateDashboardHtml([makeFileResult()], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('FAIL');
    expect(html).toContain('#999999');
    expect(html).toContain('#ffffff');
    expect(html).toContain('2.8:1');
    expect(html).toContain('1 failing');
  });

  it('shows all-passing banner when no failures', () => {
    const passing = makeResult({
      ratio: 12.5,
      meetsAA: true,
      meetsAAA: true,
      level: 'pass',
    });
    const file = makeFileResult({
      results: [passing],
      stats: { elementsAnalyzed: 1, pairsChecked: 1, passing: 1, aaFailing: 0, aaaOnlyFailing: 0, unresolvable: 0 },
    });

    const html = generateDashboardHtml([file], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('all passing');
    expect(html).toContain('PASS');
  });

  it('includes the API URL for auto-refresh', () => {
    const html = generateDashboardHtml([makeFileResult()], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain("'/_contrast'");
    expect(html).toContain('fetch(API)');
  });

  it('shows large text tag', () => {
    const largeText = makeResult({ isLargeText: true });
    const file = makeFileResult({ results: [largeText] });

    const html = generateDashboardHtml([file], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('large');
  });

  it('shows color swatches with correct RGB values', () => {
    const html = generateDashboardHtml([makeFileResult()], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('rgb(153,153,153)');
    expect(html).toContain('rgb(255,255,255)');
  });

  it('handles multiple files', () => {
    const file1 = makeFileResult({ filePath: '/project/src/pages/index.astro' });
    const file2 = makeFileResult({
      filePath: '/project/src/components/Card.astro',
      results: [makeResult({ filePath: '/project/src/components/Card.astro' })],
    });

    const html = generateDashboardHtml([file1, file2], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('2 files');
    expect(html).toContain('2 pairs');
  });

  it('handles empty results', () => {
    const html = generateDashboardHtml([], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).toContain('0 files');
    expect(html).toContain('No color pairs found');
  });

  it('escapes HTML in color values', () => {
    const xss = makeResult({
      foreground: { original: '<script>alert(1)</script>', rgb: { r: 0, g: 0, b: 0 }, source: 'stylesheet', selector: '.x' },
    });
    const file = makeFileResult({ results: [xss] });

    const html = generateDashboardHtml([file], { level: 'aa', apiUrl: '/_contrast' });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

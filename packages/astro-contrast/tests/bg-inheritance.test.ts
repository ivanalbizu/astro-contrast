import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseAstroFile } from '../src/parser/astro-parser.js';
import { analyzeFile } from '../src/analyzer.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

// ── Parser: parent tracking ─────────────────────────────────────────

describe('parseAstroFile — parent element tracking', () => {
  it('sets parentElement on child elements', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'bg-inheritance.astro'));

    // h1 inside <section> should have section as parent
    const h1 = result.htmlNodes.find(n => n.tagName === 'h1');
    expect(h1).toBeDefined();
    expect(h1!.parentElement).toBeDefined();
    expect(h1!.parentElement!.tagName).toBe('section');
  });

  it('root-level elements have null parentElement', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'simple-colors.astro'));

    // Top-level elements should have no parent (or html/body as parent)
    const hasRootElements = result.htmlNodes.some(n => n.parentElement === null || n.parentElement === undefined);
    expect(hasRootElements).toBe(true);
  });
});

// ── Background inheritance integration ──────────────────────────────

describe('background inheritance', () => {
  it('inherits inline background from parent element', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-inheritance.astro'));

    // <h1> inside <section style="background-color: #1a1a2e"> should inherit dark background
    const h1Result = result.results.find(r => r.element.tagName === 'h1');
    expect(h1Result).toBeDefined();
    expect(h1Result!.background.original).toBe('#1a1a2e');
    expect(h1Result!.background.selector).toContain('inherited');
  });

  it('detects poor contrast when parent bg matches text color', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-inheritance.astro'));

    // <p style="color: red"> inside <article style="background: red"> — ratio should be 1:1
    const redOnRed = result.results.find(
      r => r.foreground.original === 'red' && r.background.original === 'red',
    );
    expect(redOnRed).toBeDefined();
    expect(redOnRed!.ratio).toBeCloseTo(1.0, 0);
    expect(redOnRed!.meetsAA).toBe(false);
  });

  it('inherits CSS rule background from parent', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-inheritance.astro'));

    // <span> inside <div class="dark-box"> should inherit .dark-box background
    const spanResult = result.results.find(r => r.element.tagName === 'span');
    expect(spanResult).toBeDefined();
    expect(spanResult!.background.original).toBe('#222222');
    expect(spanResult!.background.selector).toContain('inherited');
  });

  it('inherits CSS rule background — red on red via class selectors', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-inheritance.astro'));

    // <h2 class="red-text"> inside <div class="page"> — both via CSS rules
    const h2Result = result.results.find(r => r.element.tagName === 'h2');
    expect(h2Result).toBeDefined();
    expect(h2Result!.foreground.original).toBe('red');
    expect(h2Result!.background.original).toBe('red');
    expect(h2Result!.background.selector).toContain('inherited');
    expect(h2Result!.ratio).toBeCloseTo(1.0, 0);
    expect(h2Result!.meetsAA).toBe(false);
  });

  it('uses body/html CSS rule as root background fallback', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-root-rule.astro'));

    // <h1 style="color: red"> with body { background: red } — should be red on red
    const h1Result = result.results.find(r => r.element.tagName === 'h1');
    expect(h1Result).toBeDefined();
    expect(h1Result!.foreground.original).toBe('red');
    expect(h1Result!.background.original).toBe('red');
    expect(h1Result!.background.selector).toContain('inherited:body');
    expect(h1Result!.ratio).toBeCloseTo(1.0, 0);
    expect(h1Result!.meetsAA).toBe(false);
  });

  it('does not affect elements with explicit background', async () => {
    const result = await analyzeFile(join(FIXTURES, 'bg-inheritance.astro'));

    // <section> has its own background — should NOT inherit
    const sectionResult = result.results.find(r => r.element.tagName === 'section');
    // section may or may not have text content; if it appears, its bg should be its own
    if (sectionResult) {
      expect(sectionResult.background.selector).not.toContain('inherited');
    }
  });
});

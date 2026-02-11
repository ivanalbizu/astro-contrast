import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { analyzeFile } from '../src/analyzer.js';
import type { ContrastResult } from '../src/types/index.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function findByClass(results: ContrastResult[], cls: string): ContrastResult | undefined {
  return results.find(r => r.element.classes.includes(cls));
}

function findByTag(results: ContrastResult[], tag: string): ContrastResult | undefined {
  return results.find(r => r.element.tagName === tag);
}

describe('large text detection — integration', () => {
  const astroFile = join(FIXTURES, 'large-text.astro');

  it('h1 is detected as large text', async () => {
    const result = await analyzeFile(astroFile);
    const h1 = findByTag(result.results, 'h1');
    expect(h1).toBeDefined();
    expect(h1!.isLargeText).toBe(true);
  });

  it('h2 is detected as large text', async () => {
    const result = await analyzeFile(astroFile);
    const h2 = findByTag(result.results, 'h2');
    expect(h2).toBeDefined();
    expect(h2!.isLargeText).toBe(true);
  });

  it('h3 is detected as large text (18.72px bold)', async () => {
    const result = await analyzeFile(astroFile);
    const h3 = findByTag(result.results, 'h3');
    expect(h3).toBeDefined();
    expect(h3!.isLargeText).toBe(true);
  });

  it('h4 is detected as large text (16px bold >= 14px bold threshold)', async () => {
    const result = await analyzeFile(astroFile);
    const h4 = findByTag(result.results, 'h4');
    expect(h4).toBeDefined();
    expect(h4!.isLargeText).toBe(true);
  });

  it('inline font-size: 24px is large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'large-inline');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(true);
  });

  it('inline 14px bold is large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'bold-14');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(true);
  });

  it('inline 14px normal is NOT large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'normal-14');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(false);
  });

  it('Tailwind text-xl (20px) is large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'tw-large');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(true);
  });

  it('Tailwind text-sm font-bold (14px bold) is large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'tw-bold');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(true);
  });

  it('Tailwind text-sm (14px normal) is NOT large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'tw-normal');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(false);
  });

  it('CSS font-size: 24px is large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'css-large');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(true);
  });

  it('CSS font-size: 14px without bold is NOT large text', async () => {
    const result = await analyzeFile(astroFile);
    const el = findByClass(result.results, 'css-normal');
    expect(el).toBeDefined();
    expect(el!.isLargeText).toBe(false);
  });

  it('large text uses lower AA threshold (3:1 instead of 4.5:1)', async () => {
    const result = await analyzeFile(astroFile);
    // #777777 on #ffffff = ~4.48:1
    // For normal text: fails AA (4.5:1)
    // For large text: passes AA (3:1)
    const h1 = findByTag(result.results, 'h1');
    expect(h1).toBeDefined();
    expect(h1!.isLargeText).toBe(true);
    expect(h1!.meetsAA).toBe(true); // 4.48:1 >= 3:1

    const normalEl = findByClass(result.results, 'css-normal');
    expect(normalEl).toBeDefined();
    expect(normalEl!.isLargeText).toBe(false);
    expect(normalEl!.meetsAA).toBe(false); // 4.48:1 < 4.5:1
  });
});

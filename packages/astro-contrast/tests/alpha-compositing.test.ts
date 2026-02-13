import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { analyzeFile } from '../src/analyzer.js';

describe('alpha compositing integration', () => {
  const fixture = join(import.meta.dirname, 'fixtures', 'alpha.astro');

  it('rgba() foreground is composited onto background', async () => {
    const result = await analyzeFile(fixture);
    // rgba(0,0,0,0.5) on #fff → composited to rgb(128,128,128) → ~3.95:1
    const pair = result.results.find(r => r.foreground.original === 'rgba(0, 0, 0, 0.5)');
    expect(pair).toBeTruthy();
    expect(pair!.ratio).toBeCloseTo(3.95, 1);
    expect(pair!.ratio).toBeLessThan(21); // NOT treated as opaque black
  });

  it('hex8 foreground is composited onto background', async () => {
    const result = await analyzeFile(fixture);
    const pair = result.results.find(r => r.foreground.original === '#00000080');
    expect(pair).toBeTruthy();
    expect(pair!.ratio).toBeCloseTo(4.0, 0); // ~50% opacity (128/255 ≈ 0.502)
    expect(pair!.ratio).toBeLessThan(21);
  });

  it('hsla() foreground is composited onto background', async () => {
    const result = await analyzeFile(fixture);
    const pair = result.results.find(r => r.foreground.original === 'hsla(0, 100%, 50%, 0.5)');
    expect(pair).toBeTruthy();
    // hsla red at 50% on white → rgb(255,128,128) — light pink
    expect(pair!.ratio).toBeGreaterThan(1);
    expect(pair!.ratio).toBeLessThan(4);
  });

  it('fully opaque rgb() is unchanged', async () => {
    const result = await analyzeFile(fixture);
    const pair = result.results.find(r => r.foreground.original === 'rgb(0, 0, 0)');
    expect(pair).toBeTruthy();
    expect(pair!.ratio).toBeCloseTo(21, 0);
  });

  it('explicit alpha=1 is same as opaque', async () => {
    const result = await analyzeFile(fixture);
    const pair = result.results.find(r => r.foreground.original === 'rgba(0, 0, 0, 1)');
    expect(pair).toBeTruthy();
    expect(pair!.ratio).toBeCloseTo(21, 0);
  });
});

describe('background alpha compositing', () => {
  const bgFixture = join(import.meta.dirname, 'fixtures', 'alpha-bg.astro');

  it('rgba() background is composited onto white (default behind)', async () => {
    const result = await analyzeFile(bgFixture);
    // rgba(255,0,0,0.5) on white → composited to rgb(255,128,128) — light pink
    const pair = result.results.find(r => r.background.original === 'rgba(255, 0, 0, 0.5)');
    expect(pair).toBeTruthy();
    // Black on pink should have good contrast but not as much as black on pure red
    expect(pair!.ratio).toBeGreaterThan(3);
    // The composited bg should be opaque (no alpha on final bg)
    expect(pair!.background.rgb!.a).toBeUndefined();
  });

  it('hex8 background is composited', async () => {
    const result = await analyzeFile(bgFixture);
    const pair = result.results.find(r => r.background.original === '#ff000080');
    expect(pair).toBeTruthy();
    expect(pair!.background.rgb!.a).toBeUndefined();
    expect(pair!.ratio).toBeGreaterThan(3);
  });

  it('hsla() background is composited', async () => {
    const result = await analyzeFile(bgFixture);
    const pair = result.results.find(r => r.background.original === 'hsla(0, 100%, 50%, 0.5)');
    expect(pair).toBeTruthy();
    expect(pair!.background.rgb!.a).toBeUndefined();
  });

  it('semi-transparent black bg on white gives gray', async () => {
    const result = await analyzeFile(bgFixture);
    // rgba(0,0,0,0.5) on white → composited bg = rgb(128,128,128)
    const pair = result.results.find(r => r.background.original === 'rgba(0, 0, 0, 0.5)');
    expect(pair).toBeTruthy();
    // Black text on gray(128) → ~5.32:1
    expect(pair!.ratio).toBeCloseTo(5.32, 1);
  });

  it('opaque background is unchanged', async () => {
    const result = await analyzeFile(bgFixture);
    const pair = result.results.find(r => r.background.original === 'rgb(255, 0, 0)');
    expect(pair).toBeTruthy();
    // Black on red → ~5.25:1
    expect(pair!.ratio).toBeCloseTo(5.25, 0);
  });
});

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

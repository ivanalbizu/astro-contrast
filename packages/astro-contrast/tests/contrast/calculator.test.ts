import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio } from '../../src/contrast/calculator.js';
import { evaluateContrast } from '../../src/contrast/wcag.js';

const black = { r: 0, g: 0, b: 0 };
const white = { r: 255, g: 255, b: 255 };

describe('relativeLuminance', () => {
  it('black has luminance 0', () => {
    expect(relativeLuminance(black)).toBeCloseTo(0, 4);
  });

  it('white has luminance 1', () => {
    expect(relativeLuminance(white)).toBeCloseTo(1, 4);
  });
});

describe('contrastRatio', () => {
  it('black on white = 21:1', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });

  it('white on white = 1:1', () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 4);
  });

  it('black on black = 1:1', () => {
    expect(contrastRatio(black, black)).toBeCloseTo(1, 4);
  });

  it('is order independent', () => {
    const r1 = contrastRatio(black, white);
    const r2 = contrastRatio(white, black);
    expect(r1).toBeCloseTo(r2, 4);
  });

  // Canonical WCAG case: #767676 on white = 4.54:1
  it('#767676 on white = ~4.54:1', () => {
    const gray = { r: 0x76, g: 0x76, b: 0x76 };
    expect(contrastRatio(gray, white)).toBeCloseTo(4.54, 1);
  });
});

describe('alpha compositing', () => {
  it('black at 50% alpha on white composites to gray (~3.95:1)', () => {
    const semiBlack = { r: 0, g: 0, b: 0, a: 0.5 };
    // Composited: rgb(128, 128, 128) on white → luminance ~0.216
    const ratio = contrastRatio(semiBlack, white);
    expect(ratio).toBeCloseTo(3.95, 1);
  });

  it('white at 50% alpha on black composites to gray (~5.32:1)', () => {
    const semiWhite = { r: 255, g: 255, b: 255, a: 0.5 };
    // Composited: rgb(128, 128, 128) on black → (0.216 + 0.05) / (0 + 0.05) = 5.32
    const ratio = contrastRatio(semiWhite, black);
    expect(ratio).toBeCloseTo(5.32, 1);
  });

  it('fully opaque (a=1) has no compositing effect', () => {
    const opaqueBlack = { r: 0, g: 0, b: 0, a: 1 };
    expect(contrastRatio(opaqueBlack, white)).toBeCloseTo(21, 0);
  });

  it('no a property = fully opaque', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });

  it('transparent foreground (a=0) matches background (1:1)', () => {
    const transparent = { r: 0, g: 0, b: 0, a: 0 };
    expect(contrastRatio(transparent, white)).toBeCloseTo(1, 4);
  });

  it('red at 50% on white', () => {
    // Composited: rgb(128+127, 128, 128) ≈ rgb(255*0.5+255*0.5, 0*0.5+255*0.5, 0*0.5+255*0.5) = rgb(128, 128, 128)
    // Wait: red at 50% on white = rgb(255*0.5 + 255*0.5, 0*0.5 + 255*0.5, 0*0.5 + 255*0.5) = rgb(255, 128, 128)
    const semiRed = { r: 255, g: 0, b: 0, a: 0.5 };
    const ratio = contrastRatio(semiRed, white);
    // rgb(255, 128, 128) on white — light pinkish, low contrast
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(4);
  });
});

describe('evaluateContrast', () => {
  it('black on white passes both AA and AAA', () => {
    const result = evaluateContrast(black, white);
    expect(result.meetsAA).toBe(true);
    expect(result.meetsAAA).toBe(true);
    expect(result.level).toBe('pass');
  });

  it('white on white fails AA', () => {
    const result = evaluateContrast(white, white);
    expect(result.meetsAA).toBe(false);
    expect(result.meetsAAA).toBe(false);
    expect(result.level).toBe('aa-fail');
  });

  it('#767676 on white passes AA but not AAA', () => {
    const gray = { r: 0x76, g: 0x76, b: 0x76 };
    const result = evaluateContrast(gray, white);
    expect(result.meetsAA).toBe(true);
    expect(result.meetsAAA).toBe(false);
    expect(result.level).toBe('aaa-only');
  });

  it('#999999 on white fails AA', () => {
    const lightGray = { r: 0x99, g: 0x99, b: 0x99 };
    const result = evaluateContrast(lightGray, white);
    expect(result.meetsAA).toBe(false);
    expect(result.level).toBe('aa-fail');
  });
});

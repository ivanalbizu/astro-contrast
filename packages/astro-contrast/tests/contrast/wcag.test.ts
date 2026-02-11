import { describe, it, expect } from 'vitest';
import { isLargeText, evaluateContrast } from '../../src/contrast/wcag.js';

describe('isLargeText', () => {
  it('returns false when fontSize is null', () => {
    expect(isLargeText(null, null)).toBe(false);
  });

  it('returns true for >= 18px', () => {
    expect(isLargeText('18px', null)).toBe(true);
    expect(isLargeText('24px', null)).toBe(true);
    expect(isLargeText('32px', null)).toBe(true);
  });

  it('returns false for < 18px without bold', () => {
    expect(isLargeText('16px', null)).toBe(false);
    expect(isLargeText('14px', null)).toBe(false);
    expect(isLargeText('12px', null)).toBe(false);
  });

  it('returns true for >= 14px with bold (700)', () => {
    expect(isLargeText('14px', '700')).toBe(true);
    expect(isLargeText('14px', 'bold')).toBe(true);
    expect(isLargeText('16px', 'bold')).toBe(true);
  });

  it('returns false for >= 14px without bold', () => {
    expect(isLargeText('14px', '400')).toBe(false);
    expect(isLargeText('14px', 'normal')).toBe(false);
    expect(isLargeText('16px', '400')).toBe(false);
  });

  it('returns false for < 14px even with bold', () => {
    expect(isLargeText('12px', 'bold')).toBe(false);
    expect(isLargeText('10px', '700')).toBe(false);
  });

  it('handles rem units (1rem = 16px)', () => {
    expect(isLargeText('1.125rem', null)).toBe(true);  // 18px
    expect(isLargeText('1.5rem', null)).toBe(true);     // 24px
    expect(isLargeText('1rem', null)).toBe(false);       // 16px
  });

  it('handles em units (1em = 16px)', () => {
    expect(isLargeText('1.125em', null)).toBe(true);  // 18px
    expect(isLargeText('1em', null)).toBe(false);       // 16px
  });

  it('handles pt units (1pt = 1.333px)', () => {
    expect(isLargeText('14pt', null)).toBe(true);   // 14 * 1.333 = 18.67px
    expect(isLargeText('13pt', null)).toBe(false);  // 13 * 1.333 = 17.33px
  });

  it('handles percentage (100% = 16px)', () => {
    expect(isLargeText('112.5%', null)).toBe(true);  // 112.5% of 16px = 18px
    expect(isLargeText('100%', null)).toBe(false);    // 100% of 16px = 16px
  });

  it('handles decimal px', () => {
    expect(isLargeText('18.72px', null)).toBe(true);
    expect(isLargeText('17.5px', null)).toBe(false);
  });

  it('handles font-weight keywords', () => {
    expect(isLargeText('14px', 'bolder')).toBe(true);
    expect(isLargeText('14px', 'lighter')).toBe(false);
  });

  it('handles font-weight numeric strings', () => {
    expect(isLargeText('14px', '800')).toBe(true);
    expect(isLargeText('14px', '600')).toBe(false);
    expect(isLargeText('14px', '900')).toBe(true);
  });
});

describe('evaluateContrast — large text thresholds', () => {
  const white = { r: 255, g: 255, b: 255 };
  // #999999 on white = ~2.85:1  → fails normal AA (4.5), fails large AA (3)
  const veryLight = { r: 0x99, g: 0x99, b: 0x99 };
  // #888888 on white = ~3.54:1  → fails normal AA (4.5), passes large AA (3)
  const midGray = { r: 0x88, g: 0x88, b: 0x88 };
  // #767676 on white = ~4.54:1  → passes normal AA (4.5), passes large AA (3)
  const darkerGray = { r: 0x76, g: 0x76, b: 0x76 };

  it('normal text: ratio 3.54 fails AA', () => {
    const result = evaluateContrast(midGray, white);
    expect(result.meetsAA).toBe(false);
    expect(result.isLargeText).toBe(false);
  });

  it('large text: ratio 3.54 passes AA', () => {
    const result = evaluateContrast(midGray, white, { fontSize: '24px' });
    expect(result.meetsAA).toBe(true);
    expect(result.isLargeText).toBe(true);
  });

  it('large text (14px bold): ratio 3.54 passes AA', () => {
    const result = evaluateContrast(midGray, white, { fontSize: '14px', fontWeight: 'bold' });
    expect(result.meetsAA).toBe(true);
    expect(result.isLargeText).toBe(true);
  });

  it('normal text: ratio 4.54 passes AA', () => {
    const result = evaluateContrast(darkerGray, white);
    expect(result.meetsAA).toBe(true);
    expect(result.isLargeText).toBe(false);
  });

  it('large text: ratio 4.54 passes AAA (large threshold 4.5)', () => {
    const result = evaluateContrast(darkerGray, white, { fontSize: '24px' });
    expect(result.meetsAAA).toBe(true);
    expect(result.isLargeText).toBe(true);
  });

  it('normal text: ratio 4.54 does NOT pass AAA (normal threshold 7)', () => {
    const result = evaluateContrast(darkerGray, white);
    expect(result.meetsAAA).toBe(false);
    expect(result.isLargeText).toBe(false);
  });

  it('no options defaults to normal text', () => {
    const result = evaluateContrast(midGray, white);
    expect(result.isLargeText).toBe(false);
    expect(result.meetsAA).toBe(false);
  });
});

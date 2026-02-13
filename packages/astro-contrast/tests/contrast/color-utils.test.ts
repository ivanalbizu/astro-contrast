import { describe, it, expect } from 'vitest';
import { parseColor } from '../../src/contrast/color-utils.js';

describe('parseColor', () => {
  describe('hex colors', () => {
    it('parses 6-digit hex', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColor('#1a5276')).toEqual({ r: 26, g: 82, b: 118 });
    });

    it('parses 3-digit hex', () => {
      expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses 8-digit hex with alpha', () => {
      const c = parseColor('#ff000080');
      expect(c).toEqual({ r: 255, g: 0, b: 0, a: expect.closeTo(0.502, 2) });
    });

    it('parses 4-digit hex with alpha', () => {
      const c = parseColor('#f008');
      expect(c).toEqual({ r: 255, g: 0, b: 0, a: expect.closeTo(0.533, 2) });
    });

    it('is case insensitive', () => {
      expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('#AbCdEf')).toEqual({ r: 171, g: 205, b: 239 });
    });
  });

  describe('rgb/rgba', () => {
    it('parses rgb() with commas', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255 });
    });

    it('parses rgb() with spaces (modern syntax)', () => {
      expect(parseColor('rgb(255 0 0)')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('parses rgba() with alpha', () => {
      expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });

    it('clamps values to 0-255', () => {
      expect(parseColor('rgb(300, -10, 128)')).toEqual({ r: 255, g: 0, b: 128 });
    });
  });

  describe('hsl/hsla', () => {
    it('parses hsl() red', () => {
      expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('parses hsl() green', () => {
      expect(parseColor('hsl(120, 100%, 50%)')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('parses hsl() blue', () => {
      expect(parseColor('hsl(240, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('parses hsl() grayscale (saturation 0)', () => {
      expect(parseColor('hsl(0, 0%, 50%)')).toEqual({ r: 128, g: 128, b: 128 });
      expect(parseColor('hsl(0, 0%, 0%)')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('hsl(0, 0%, 100%)')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses hsla() with alpha', () => {
      expect(parseColor('hsla(0, 100%, 50%, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });
  });

  describe('named colors', () => {
    it('parses common named colors', () => {
      expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('blue')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('is case insensitive', () => {
      expect(parseColor('Red')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('WHITE')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses rebeccapurple', () => {
      expect(parseColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153 });
    });
  });

  describe('oklab', () => {
    it('parses oklab() black', () => {
      const c = parseColor('oklab(0 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeLessThanOrEqual(1);
      expect(c!.g).toBeLessThanOrEqual(1);
      expect(c!.b).toBeLessThanOrEqual(1);
    });

    it('parses oklab() white', () => {
      const c = parseColor('oklab(1 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThanOrEqual(254);
      expect(c!.g).toBeGreaterThanOrEqual(254);
      expect(c!.b).toBeGreaterThanOrEqual(254);
    });

    it('parses oklab() color', () => {
      // oklab(0.7 -0.1 0.1) ≈ a greenish color
      const c = parseColor('oklab(0.7 -0.1 0.1)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThan(0);
      expect(c!.g).toBeGreaterThan(c!.r); // green-ish
    });

    it('parses oklab() with percentage lightness', () => {
      const c = parseColor('oklab(50% 0 0)');
      expect(c).toBeTruthy();
      // 50% = 0.5 lightness → mid gray
      expect(c!.r).toBeGreaterThan(50);
      expect(c!.r).toBeLessThan(200);
    });

    it('parses oklab() with alpha', () => {
      const c = parseColor('oklab(0.7 -0.1 0.1 / 0.5)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.5);
    });
  });

  describe('oklch', () => {
    it('parses oklch() black', () => {
      const c = parseColor('oklch(0 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeLessThanOrEqual(1);
      expect(c!.g).toBeLessThanOrEqual(1);
      expect(c!.b).toBeLessThanOrEqual(1);
    });

    it('parses oklch() white', () => {
      const c = parseColor('oklch(1 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThanOrEqual(254);
      expect(c!.g).toBeGreaterThanOrEqual(254);
      expect(c!.b).toBeGreaterThanOrEqual(254);
    });

    it('parses oklch() with hue', () => {
      // oklch(0.7 0.15 180) — teal-ish color
      const c = parseColor('oklch(0.7 0.15 180)');
      expect(c).toBeTruthy();
      expect(c!.g).toBeGreaterThan(c!.r); // greenish
    });

    it('parses oklch() with deg unit', () => {
      const c = parseColor('oklch(0.7 0.15 180deg)');
      expect(c).toBeTruthy();
      expect(c!.g).toBeGreaterThan(c!.r);
    });

    it('parses oklch() with turn unit', () => {
      // 0.5turn = 180deg
      const a = parseColor('oklch(0.7 0.15 180)');
      const b = parseColor('oklch(0.7 0.15 0.5turn)');
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(Math.abs(a!.r - b!.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(a!.g - b!.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(a!.b - b!.b)).toBeLessThanOrEqual(1);
    });

    it('parses oklch() with alpha', () => {
      const c = parseColor('oklch(0.7 0.15 180 / 0.5)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.5);
    });
  });

  describe('lab', () => {
    it('parses lab() black', () => {
      const c = parseColor('lab(0 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeLessThanOrEqual(1);
      expect(c!.g).toBeLessThanOrEqual(1);
      expect(c!.b).toBeLessThanOrEqual(1);
    });

    it('parses lab() white', () => {
      const c = parseColor('lab(100 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThanOrEqual(254);
      expect(c!.g).toBeGreaterThanOrEqual(254);
      expect(c!.b).toBeGreaterThanOrEqual(254);
    });

    it('parses lab() mid gray', () => {
      // lab(50 0 0) = 50% lightness, achromatic
      const c = parseColor('lab(50 0 0)');
      expect(c).toBeTruthy();
      expect(Math.abs(c!.r - c!.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(c!.g - c!.b)).toBeLessThanOrEqual(2);
      expect(c!.r).toBeGreaterThan(80);
      expect(c!.r).toBeLessThan(150);
    });

    it('parses lab() with positive a (reddish)', () => {
      const c = parseColor('lab(50 60 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThan(c!.g); // reddish
    });

    it('parses lab() with percentage lightness', () => {
      const c = parseColor('lab(50% 0 0)');
      expect(c).toBeTruthy();
      // 50% of 100 = L=50
      expect(c!.r).toBeGreaterThan(80);
      expect(c!.r).toBeLessThan(150);
    });

    it('parses lab() with alpha', () => {
      const c = parseColor('lab(50 40 -20 / 0.8)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.8);
    });
  });

  describe('lch', () => {
    it('parses lch() black', () => {
      const c = parseColor('lch(0 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeLessThanOrEqual(1);
      expect(c!.g).toBeLessThanOrEqual(1);
      expect(c!.b).toBeLessThanOrEqual(1);
    });

    it('parses lch() white', () => {
      const c = parseColor('lch(100 0 0)');
      expect(c).toBeTruthy();
      expect(c!.r).toBeGreaterThanOrEqual(254);
      expect(c!.g).toBeGreaterThanOrEqual(254);
      expect(c!.b).toBeGreaterThanOrEqual(254);
    });

    it('parses lch() with chroma and hue', () => {
      // lch(50 60 270) — blueish
      const c = parseColor('lch(50 60 270)');
      expect(c).toBeTruthy();
      expect(c!.b).toBeGreaterThan(c!.r); // blue
    });

    it('parses lch() with deg unit', () => {
      const a = parseColor('lch(50 60 270)');
      const b = parseColor('lch(50 60 270deg)');
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a!.r).toBe(b!.r);
      expect(a!.g).toBe(b!.g);
      expect(a!.b).toBe(b!.b);
    });

    it('parses lch() with rad unit', () => {
      // π rad = 180deg
      const a = parseColor('lch(50 60 180)');
      const b = parseColor(`lch(50 60 ${Math.PI}rad)`);
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(Math.abs(a!.r - b!.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(a!.g - b!.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(a!.b - b!.b)).toBeLessThanOrEqual(1);
    });
  });

  describe('alpha channel', () => {
    it('rgb() modern syntax with / alpha', () => {
      expect(parseColor('rgb(255 0 0 / 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });

    it('rgb() with percentage alpha', () => {
      expect(parseColor('rgba(255, 0, 0, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });

    it('hsl() modern syntax with / alpha', () => {
      const c = parseColor('hsl(0 100% 50% / 0.3)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.3);
    });

    it('lch() with alpha', () => {
      const c = parseColor('lch(50 60 270 / 0.7)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.7);
    });

    it('oklab() with percentage alpha', () => {
      const c = parseColor('oklab(0.5 0 0 / 50%)');
      expect(c).toBeTruthy();
      expect(c!.a).toBe(0.5);
    });

    it('opaque colors have no a property', () => {
      expect(parseColor('#ff0000')).not.toHaveProperty('a');
      expect(parseColor('rgb(255, 0, 0)')).not.toHaveProperty('a');
      expect(parseColor('hsl(0, 100%, 50%)')).not.toHaveProperty('a');
    });

    it('hex ff alpha is ~1', () => {
      const c = parseColor('#ff0000ff');
      expect(c).toBeTruthy();
      expect(c!.a).toBeCloseTo(1, 2);
    });
  });

  describe('special values', () => {
    it('returns null for transparent', () => {
      expect(parseColor('transparent')).toBeNull();
    });

    it('returns null for unrecognized values', () => {
      expect(parseColor('var(--color)')).toBeNull();
      expect(parseColor('inherit')).toBeNull();
      expect(parseColor('currentColor')).toBeNull();
      expect(parseColor('nonsense')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(parseColor('  #ff0000  ')).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('color-mix()', () => {
    it('mixes two colors 50/50 in srgb', () => {
      // black + white → gray
      const result = parseColor('color-mix(in srgb, #000000, #ffffff)');
      expect(result).toEqual({ r: 128, g: 128, b: 128 });
    });

    it('mixes with explicit percentages', () => {
      // 75% red + 25% blue
      const result = parseColor('color-mix(in srgb, red 75%, blue 25%)');
      expect(result).toEqual({ r: 191, g: 0, b: 64 });
    });

    it('infers missing percentage from the other', () => {
      // 80% white → 20% black
      const result = parseColor('color-mix(in srgb, #ffffff 80%, #000000)');
      expect(result).toEqual({ r: 204, g: 204, b: 204 });
    });

    it('handles 98%/2% mix', () => {
      // 98% white + 2% black
      const result = parseColor('color-mix(in srgb, #ffffff 98%, #000000)');
      expect(result).toEqual({ r: 250, g: 250, b: 250 });
    });

    it('handles named colors', () => {
      const result = parseColor('color-mix(in srgb, white, black)');
      expect(result).toEqual({ r: 128, g: 128, b: 128 });
    });

    it('handles rgb() colors inside', () => {
      const result = parseColor('color-mix(in srgb, rgb(255, 0, 0) 50%, rgb(0, 0, 255) 50%)');
      expect(result).toEqual({ r: 128, g: 0, b: 128 });
    });

    it('interpolates in oklch color space', () => {
      const result = parseColor('color-mix(in oklch, red, blue)');
      expect(result).not.toBeNull();
      // oklch interpolation produces a different result than srgb
      const srgbResult = parseColor('color-mix(in srgb, red, blue)');
      expect(result).not.toEqual(srgbResult);
    });

    it('interpolates in oklab color space', () => {
      const result = parseColor('color-mix(in oklab, red, blue)');
      expect(result).not.toBeNull();
    });

    it('interpolates in hsl color space', () => {
      const result = parseColor('color-mix(in hsl, red, blue)');
      expect(result).not.toBeNull();
    });

    it('interpolates in lab color space', () => {
      const result = parseColor('color-mix(in lab, white, black)');
      expect(result).not.toBeNull();
    });

    it('interpolates in srgb-linear color space', () => {
      const result = parseColor('color-mix(in srgb-linear, white, black)');
      expect(result).not.toBeNull();
      // srgb-linear midpoint is different from srgb midpoint
      const srgbResult = parseColor('color-mix(in srgb, white, black)');
      expect(result).not.toEqual(srgbResult);
    });

    it('returns null for unsupported color space', () => {
      expect(parseColor('color-mix(in display-p3, red, blue)')).toBeNull();
    });

    it('returns null for unresolvable colors', () => {
      expect(parseColor('color-mix(in srgb, var(--x), red)')).toBeNull();
    });
  });
});

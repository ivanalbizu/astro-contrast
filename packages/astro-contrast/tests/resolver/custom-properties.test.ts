import { describe, it, expect } from 'vitest';
import { resolveCustomProperty } from '../../src/resolver/custom-properties.js';

describe('resolveCustomProperty', () => {
  it('resolves a simple var()', () => {
    const props = new Map([['--primary', '#ff0000']]);
    expect(resolveCustomProperty('var(--primary)', props)).toBe('#ff0000');
  });

  it('returns plain values unchanged', () => {
    const props = new Map();
    expect(resolveCustomProperty('#ff0000', props)).toBe('#ff0000');
    expect(resolveCustomProperty('red', props)).toBe('red');
  });

  it('uses fallback when property not found', () => {
    const props = new Map();
    expect(resolveCustomProperty('var(--missing, blue)', props)).toBe('blue');
    expect(resolveCustomProperty('var(--missing, #ff0000)', props)).toBe('#ff0000');
  });

  it('returns null when property not found and no fallback', () => {
    const props = new Map();
    expect(resolveCustomProperty('var(--missing)', props)).toBeNull();
  });

  it('resolves nested var() references', () => {
    const props = new Map([
      ['--a', 'var(--b)'],
      ['--b', '#000000'],
    ]);
    expect(resolveCustomProperty('var(--a)', props)).toBe('#000000');
  });

  it('handles circular references (returns null at max depth)', () => {
    const props = new Map([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ]);
    expect(resolveCustomProperty('var(--a)', props)).toBeNull();
  });

  it('resolves fallback with var()', () => {
    const props = new Map([['--fallback', 'green']]);
    expect(resolveCustomProperty('var(--missing, var(--fallback))', props)).toBe('green');
  });

  it('resolves var() inside color-mix()', () => {
    const props = new Map([
      ['--color-base', '#ffffff'],
      ['--color-main', '#000000'],
    ]);
    const result = resolveCustomProperty(
      'color-mix(in srgb, var(--color-base) 98%, var(--color-main))',
      props,
    );
    expect(result).toBe('color-mix(in srgb, #ffffff 98%, #000000)');
  });

  it('returns null when var() inside color-mix() is unresolvable', () => {
    const props = new Map();
    const result = resolveCustomProperty(
      'color-mix(in srgb, var(--missing) 50%, red)',
      props,
    );
    expect(result).toBeNull();
  });
});

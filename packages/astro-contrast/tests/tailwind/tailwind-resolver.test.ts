import { describe, it, expect } from 'vitest';
import {
  resolveTailwindColor,
  resolveTailwindForeground,
  resolveTailwindBackground,
} from '../../src/tailwind/tailwind-resolver.js';
import { buildColorPairs } from '../../src/matcher/selector-matcher.js';
import type { HtmlElementInfo } from '../../src/types/index.js';

function makeElement(overrides: Partial<HtmlElementInfo> = {}): HtmlElementInfo {
  return {
    tagName: 'p',
    classes: [],
    id: null,
    inlineStyles: null,
    position: { line: 1, column: 1 },
    hasTextContent: true,
    ignored: false,
    ...overrides,
  };
}

describe('resolveTailwindColor', () => {
  describe('palette colors with shade', () => {
    it('resolves text-blue-500', () => {
      const result = resolveTailwindColor('text-blue-500');
      expect(result).toEqual({
        property: 'color',
        value: '#3b82f6',
        className: 'text-blue-500',
      });
    });

    it('resolves bg-red-600', () => {
      const result = resolveTailwindColor('bg-red-600');
      expect(result).toEqual({
        property: 'background-color',
        value: '#dc2626',
        className: 'bg-red-600',
      });
    });

    it('resolves text-slate-950', () => {
      const result = resolveTailwindColor('text-slate-950');
      expect(result?.value).toBe('#020617');
    });

    it('resolves bg-emerald-50', () => {
      const result = resolveTailwindColor('bg-emerald-50');
      expect(result?.value).toBe('#ecfdf5');
    });

    it('resolves bg-sky-400', () => {
      const result = resolveTailwindColor('bg-sky-400');
      expect(result?.value).toBe('#38bdf8');
    });
  });

  describe('colors without shade', () => {
    it('resolves text-white', () => {
      const result = resolveTailwindColor('text-white');
      expect(result).toEqual({
        property: 'color',
        value: '#ffffff',
        className: 'text-white',
      });
    });

    it('resolves text-black', () => {
      const result = resolveTailwindColor('text-black');
      expect(result?.value).toBe('#000000');
    });

    it('resolves bg-white', () => {
      const result = resolveTailwindColor('bg-white');
      expect(result).toEqual({
        property: 'background-color',
        value: '#ffffff',
        className: 'bg-white',
      });
    });

    it('resolves bg-black', () => {
      const result = resolveTailwindColor('bg-black');
      expect(result?.value).toBe('#000000');
    });
  });

  describe('arbitrary values', () => {
    it('resolves text-[#1a5276]', () => {
      const result = resolveTailwindColor('text-[#1a5276]');
      expect(result).toEqual({
        property: 'color',
        value: '#1a5276',
        className: 'text-[#1a5276]',
      });
    });

    it('resolves bg-[rgb(26,82,118)]', () => {
      const result = resolveTailwindColor('bg-[rgb(26,82,118)]');
      expect(result).toEqual({
        property: 'background-color',
        value: 'rgb(26,82,118)',
        className: 'bg-[rgb(26,82,118)]',
      });
    });

    it('resolves bg-[#ff6600]', () => {
      const result = resolveTailwindColor('bg-[#ff6600]');
      expect(result?.value).toBe('#ff6600');
    });
  });

  describe('non-color utilities', () => {
    it('returns null for text-center', () => {
      expect(resolveTailwindColor('text-center')).toBeNull();
    });

    it('returns null for text-lg', () => {
      expect(resolveTailwindColor('text-lg')).toBeNull();
    });

    it('returns null for text-xl', () => {
      expect(resolveTailwindColor('text-xl')).toBeNull();
    });

    it('returns null for bg-cover', () => {
      expect(resolveTailwindColor('bg-cover')).toBeNull();
    });

    it('returns null for bg-no-repeat', () => {
      expect(resolveTailwindColor('bg-no-repeat')).toBeNull();
    });

    it('returns null for bg-clip-text', () => {
      expect(resolveTailwindColor('bg-clip-text')).toBeNull();
    });

    it('returns null for non-matching classes', () => {
      expect(resolveTailwindColor('flex')).toBeNull();
      expect(resolveTailwindColor('p-4')).toBeNull();
      expect(resolveTailwindColor('font-bold')).toBeNull();
    });

    it('returns null for invalid color names', () => {
      expect(resolveTailwindColor('text-foo-500')).toBeNull();
      expect(resolveTailwindColor('bg-unicorn-200')).toBeNull();
    });
  });
});

describe('resolveTailwindForeground', () => {
  it('returns the last matching text color class', () => {
    const result = resolveTailwindForeground(['text-red-500', 'text-blue-600']);
    expect(result?.value).toBe('#2563eb');
    expect(result?.className).toBe('text-blue-600');
  });

  it('ignores bg classes', () => {
    const result = resolveTailwindForeground(['bg-red-500', 'text-white']);
    expect(result?.value).toBe('#ffffff');
  });

  it('returns null if no text color class', () => {
    expect(resolveTailwindForeground(['bg-blue-500', 'flex'])).toBeNull();
  });
});

describe('resolveTailwindBackground', () => {
  it('returns the last matching bg color class', () => {
    const result = resolveTailwindBackground(['bg-white', 'bg-blue-500']);
    expect(result?.value).toBe('#3b82f6');
  });

  it('ignores text classes', () => {
    const result = resolveTailwindBackground(['text-white', 'bg-black']);
    expect(result?.value).toBe('#000000');
  });

  it('returns null if no bg color class', () => {
    expect(resolveTailwindBackground(['text-white', 'flex'])).toBeNull();
  });
});

describe('buildColorPairs with Tailwind classes', () => {
  it('creates pair from Tailwind classes', () => {
    const elements = [makeElement({ classes: ['text-white', 'bg-blue-500'] })];
    const pairs = buildColorPairs(elements, []);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('text-white');
    expect(pairs[0].foreground.rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(pairs[0].background.original).toBe('bg-blue-500');
    expect(pairs[0].background.rgb).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('Tailwind fg with CSS bg', () => {
    const elements = [makeElement({ classes: ['text-white'] })];
    const rules = [{ selector: 'p', declarations: [{ property: 'background-color', value: '#1a5276', resolvedValue: '#1a5276' }], ignored: false }];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('text-white');
    expect(pairs[0].background.original).toBe('#1a5276');
  });

  it('inline style takes priority over Tailwind', () => {
    const elements = [makeElement({
      classes: ['text-blue-500', 'bg-red-500'],
      inlineStyles: { color: '#000000', backgroundColor: null, fontSize: null, fontWeight: null },
    })];

    const pairs = buildColorPairs(elements, []);
    expect(pairs[0].foreground.original).toBe('#000000');
    expect(pairs[0].background.original).toBe('bg-red-500');
  });

  it('Tailwind takes priority over CSS rules', () => {
    const elements = [makeElement({ classes: ['title', 'text-white'] })];
    const rules = [{ selector: '.title', declarations: [{ property: 'color', value: '#333', resolvedValue: '#333' }], ignored: false }];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs[0].foreground.original).toBe('text-white');
  });

  it('assumes default background with only Tailwind fg', () => {
    const elements = [makeElement({ classes: ['text-red-500'] })];
    const pairs = buildColorPairs(elements, []);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('text-red-500');
    expect(pairs[0].background.original).toBe('#ffffff (assumed)');
  });

  it('arbitrary values work in pairs', () => {
    const elements = [makeElement({ classes: ['text-[#fff]', 'bg-[#1a5276]'] })];
    const pairs = buildColorPairs(elements, []);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(pairs[0].background.rgb).toEqual({ r: 26, g: 82, b: 118 });
  });
});

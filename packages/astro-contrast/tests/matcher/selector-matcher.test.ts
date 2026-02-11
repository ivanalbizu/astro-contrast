import { describe, it, expect } from 'vitest';
import { buildColorPairs } from '../../src/matcher/selector-matcher.js';
import type { HtmlElementInfo, CssRuleInfo } from '../../src/types/index.js';

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

function makeRule(selector: string, declarations: Array<{ property: string; value: string }>): CssRuleInfo {
  return {
    selector,
    declarations: declarations.map(d => ({ ...d, resolvedValue: d.value })),
    ignored: false,
  };
}

describe('buildColorPairs', () => {
  it('matches element by class', () => {
    const elements = [makeElement({ classes: ['title'] })];
    const rules = [makeRule('.title', [{ property: 'color', value: '#333333' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('#333333');
  });

  it('matches element by tag name', () => {
    const elements = [makeElement({ tagName: 'h1' })];
    const rules = [makeRule('h1', [{ property: 'color', value: '#111111' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('#111111');
  });

  it('matches element by ID', () => {
    const elements = [makeElement({ id: 'main' })];
    const rules = [makeRule('#main', [{ property: 'color', value: 'red' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('matches compound selector (tag + class)', () => {
    const elements = [
      makeElement({ tagName: 'h1', classes: ['title'] }),
      makeElement({ tagName: 'p', classes: ['title'] }),
    ];
    const rules = [makeRule('h1.title', [{ property: 'color', value: '#333' }])];

    const pairs = buildColorPairs(elements, rules);
    // Only h1.title should match, not p.title
    expect(pairs).toHaveLength(1);
    expect(pairs[0].element.tagName).toBe('h1');
  });

  it('prefers more specific selector', () => {
    const elements = [makeElement({ tagName: 'p', classes: ['subtitle'] })];
    const rules = [
      makeRule('p', [{ property: 'color', value: '#000' }]),
      makeRule('.subtitle', [{ property: 'color', value: '#999' }]),
    ];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs[0].foreground.original).toBe('#999');
  });

  it('inline styles have highest priority', () => {
    const elements = [
      makeElement({
        classes: ['title'],
        inlineStyles: { color: '#ff0000', backgroundColor: null, fontSize: null, fontWeight: null },
      }),
    ];
    const rules = [makeRule('.title', [{ property: 'color', value: '#333' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs[0].foreground.original).toBe('#ff0000');
  });

  it('assumes defaults when only one color is specified', () => {
    const elements = [makeElement({ classes: ['text'] })];
    const rules = [makeRule('.text', [{ property: 'color', value: '#333' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs[0].foreground.original).toBe('#333');
    expect(pairs[0].background.original).toBe('#ffffff (assumed)');
  });

  it('skips elements without text content', () => {
    const elements = [makeElement({ hasTextContent: false, classes: ['box'] })];
    const rules = [makeRule('.box', [{ property: 'color', value: '#333' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(0);
  });

  it('skips elements with no matching color rules', () => {
    const elements = [makeElement({ classes: ['no-match'] })];
    const rules = [makeRule('.other', [{ property: 'color', value: '#333' }])];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(0);
  });

  it('handles both foreground and background from rules', () => {
    const elements = [makeElement({ classes: ['btn'] })];
    const rules = [
      makeRule('.btn', [
        { property: 'color', value: '#ffffff' },
        { property: 'background-color', value: '#1a5276' },
      ]),
    ];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].foreground.original).toBe('#ffffff');
    expect(pairs[0].background.original).toBe('#1a5276');
  });
});

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseAstroFile } from '../src/parser/astro-parser.js';
import { parseCssBlock } from '../src/parser/css-parser.js';
import { buildColorPairs } from '../src/matcher/selector-matcher.js';
import type { HtmlElementInfo, CssRuleInfo } from '../src/types/index.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

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

describe('ignore — HTML comment', () => {
  it('marks element after <!-- astro-contrast-ignore --> as ignored', async () => {
    const parsed = await parseAstroFile(join(FIXTURES, 'ignore-comment.astro'));
    const ignored = parsed.htmlNodes.find(n => n.classes.includes('ignored-comment'));
    const visible = parsed.htmlNodes.find(n => n.classes.includes('visible'));
    const alsoVisible = parsed.htmlNodes.find(n => n.classes.includes('also-visible'));

    expect(ignored?.ignored).toBe(true);
    expect(visible?.ignored).toBe(false);
    expect(alsoVisible?.ignored).toBe(false);
  });

  it('ignored element is excluded from color pairs', async () => {
    const parsed = await parseAstroFile(join(FIXTURES, 'ignore-comment.astro'));
    const pairs = buildColorPairs(parsed.htmlNodes, parsed.styleRules);

    const selectors = pairs.map(p => p.foreground.selector);
    expect(selectors).not.toContain('.ignored-comment');
    // visible and also-visible should still produce pairs
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ignore — data-contrast-ignore attribute', () => {
  it('marks element with data-contrast-ignore as ignored', async () => {
    const parsed = await parseAstroFile(join(FIXTURES, 'ignore-attribute.astro'));
    const ignored = parsed.htmlNodes.find(n => n.classes.includes('ignored-attr'));
    const normal = parsed.htmlNodes.find(n => n.classes.includes('normal'));

    expect(ignored?.ignored).toBe(true);
    expect(normal?.ignored).toBe(false);
  });

  it('ignored element is excluded from color pairs', async () => {
    const parsed = await parseAstroFile(join(FIXTURES, 'ignore-attribute.astro'));
    const pairs = buildColorPairs(parsed.htmlNodes, parsed.styleRules);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].element.classes).toContain('normal');
  });
});

describe('ignore — CSS comment', () => {
  it('marks CSS rule after /* astro-contrast-ignore */ as ignored', () => {
    const css = `
      .checked {
        color: #333;
        background-color: #fff;
      }
      /* astro-contrast-ignore */
      .skipped {
        color: #ccc;
        background-color: #ddd;
      }
    `;
    const { rules } = parseCssBlock(css);
    const checked = rules.find(r => r.selector === '.checked');
    const skipped = rules.find(r => r.selector === '.skipped');

    expect(checked?.ignored).toBe(false);
    expect(skipped?.ignored).toBe(true);
  });

  it('ignored CSS rule is excluded from color pairs', () => {
    const css = `
      .normal { color: #333; background-color: #fff; }
      /* astro-contrast-ignore */
      .skipped { color: #ccc; background-color: #ddd; }
    `;
    const { rules } = parseCssBlock(css);
    const elements = [
      makeElement({ classes: ['normal'] }),
      makeElement({ classes: ['skipped'] }),
    ];

    const pairs = buildColorPairs(elements, rules);
    // .skipped has no non-ignored rules matching, so no pair
    expect(pairs).toHaveLength(1);
    expect(pairs[0].element.classes).toContain('normal');
  });

  it('does not ignore rules without preceding comment', () => {
    const css = `
      /* some other comment */
      .first { color: #333; }
      .second { color: #666; }
    `;
    const { rules } = parseCssBlock(css);
    expect(rules.every(r => !r.ignored)).toBe(true);
  });
});

describe('ignore — full .astro file with CSS ignore', () => {
  it('skipped CSS rule produces no pair for matching element', async () => {
    const parsed = await parseAstroFile(join(FIXTURES, 'ignore-css.astro'));
    const pairs = buildColorPairs(parsed.htmlNodes, parsed.styleRules);

    const pairSelectors = pairs.map(p => p.foreground.selector);
    expect(pairSelectors).toContain('.checked');
    expect(pairSelectors).not.toContain('.skipped');
  });
});

describe('ignore — buildColorPairs integration', () => {
  it('skips HTML-ignored elements even if CSS rules match', () => {
    const elements = [
      makeElement({ classes: ['btn'], ignored: true }),
      makeElement({ classes: ['link'] }),
    ];
    const rules: CssRuleInfo[] = [
      { selector: '.btn', declarations: [{ property: 'color', value: '#fff', resolvedValue: '#fff' }], ignored: false },
      { selector: '.link', declarations: [{ property: 'color', value: '#00f', resolvedValue: '#00f' }], ignored: false },
    ];

    const pairs = buildColorPairs(elements, rules);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].element.classes).toContain('link');
  });

  it('skips CSS-ignored rules even if element matches', () => {
    const elements = [makeElement({ classes: ['special'] })];
    const rules: CssRuleInfo[] = [
      { selector: '.special', declarations: [{ property: 'color', value: '#ccc', resolvedValue: '#ccc' }], ignored: true },
    ];

    const pairs = buildColorPairs(elements, rules);
    // No non-ignored color rules match, so no pair
    expect(pairs).toHaveLength(0);
  });
});

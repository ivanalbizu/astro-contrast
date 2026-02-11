import { describe, it, expect } from 'vitest';
import { parseAstroFile } from '../../src/parser/astro-parser.js';
import { resolve } from 'node:path';

const fixture = (name: string) => resolve(import.meta.dirname, '../fixtures', name);

describe('parseAstroFile', () => {
  it('extracts HTML elements with classes', async () => {
    const result = await parseAstroFile(fixture('simple-colors.astro'));

    const tagNames = result.htmlNodes.map(n => n.tagName);
    expect(tagNames).toContain('div');
    expect(tagNames).toContain('h1');
    expect(tagNames).toContain('p');

    const h1 = result.htmlNodes.find(n => n.tagName === 'h1');
    expect(h1?.classes).toContain('title');
    expect(h1?.hasTextContent).toBe(true);
  });

  it('extracts CSS rules from style block', async () => {
    const result = await parseAstroFile(fixture('simple-colors.astro'));

    expect(result.styleRules.length).toBeGreaterThan(0);

    const titleRule = result.styleRules.find(r => r.selector === '.title');
    expect(titleRule).toBeDefined();
    expect(titleRule?.declarations).toContainEqual({
      property: 'color',
      value: '#333333',
      resolvedValue: null,
    });
  });

  it('extracts custom properties from :root', async () => {
    const result = await parseAstroFile(fixture('custom-properties.astro'));

    expect(result.customProperties.get('--badge-bg')).toBe('#2ecc71');
    expect(result.customProperties.get('--badge-text')).toBe('#ffffff');
  });

  it('extracts var() references in declarations', async () => {
    const result = await parseAstroFile(fixture('custom-properties.astro'));

    const badgeRule = result.styleRules.find(r => r.selector === '.badge');
    expect(badgeRule).toBeDefined();

    const colorDecl = badgeRule?.declarations.find(d => d.property === 'color');
    expect(colorDecl?.value).toBe('var(--badge-text)');
  });

  it('handles files with no styles', async () => {
    const result = await parseAstroFile(fixture('no-styles.astro'));

    expect(result.styleRules).toHaveLength(0);
    expect(result.customProperties.size).toBe(0);
    expect(result.htmlNodes.length).toBeGreaterThan(0);
  });
});

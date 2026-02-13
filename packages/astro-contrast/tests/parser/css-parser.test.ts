import { describe, it, expect } from 'vitest';
import { parseCssBlock } from '../../src/parser/css-parser.js';

describe('parseCssBlock', () => {
  it('extracts color declarations from rules', () => {
    const css = `
      .title { color: #333333; }
      .card { background-color: #ffffff; }
    `;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(2);
    expect(rules[0].selector).toBe('.title');
    expect(rules[0].declarations[0]).toEqual({
      property: 'color',
      value: '#333333',
      resolvedValue: null,
    });
  });

  it('extracts custom properties from :root', () => {
    const css = `
      :root {
        --primary: #ff0000;
        --bg: #ffffff;
      }
    `;
    const { customProperties } = parseCssBlock(css);

    expect(customProperties.get('--primary')).toBe('#ff0000');
    expect(customProperties.get('--bg')).toBe('#ffffff');
  });

  it('splits compound selectors', () => {
    const css = `.btn, .link { color: blue; }`;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(2);
    expect(rules[0].selector).toBe('.btn');
    expect(rules[1].selector).toBe('.link');
  });

  it('ignores non-color/typography properties', () => {
    const css = `.box { padding: 8px; margin: 16px; display: flex; }`;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(0);
  });

  it('extracts font-size and font-weight', () => {
    const css = `.heading { font-size: 24px; font-weight: bold; color: #333; }`;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(1);
    const decls = rules[0].declarations;
    expect(decls.some(d => d.property === 'font-size' && d.value === '24px')).toBe(true);
    expect(decls.some(d => d.property === 'font-weight' && d.value === 'bold')).toBe(true);
    expect(decls.some(d => d.property === 'color' && d.value === '#333')).toBe(true);
  });

  it('ignores background with url() or gradient', () => {
    const css = `
      .bg-image { background: url('image.png'); }
      .bg-gradient { background: linear-gradient(red, blue); }
    `;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(0);
  });

  it('extracts background shorthand with simple color', () => {
    const css = `.card { background: #f0f0f0; }`;
    const { rules } = parseCssBlock(css);

    expect(rules).toHaveLength(1);
    expect(rules[0].declarations[0].property).toBe('background');
    expect(rules[0].declarations[0].value).toBe('#f0f0f0');
  });

  it('handles empty CSS', () => {
    const { rules, customProperties } = parseCssBlock('');
    expect(rules).toHaveLength(0);
    expect(customProperties.size).toBe(0);
  });

  it('handles invalid CSS gracefully', () => {
    const { rules } = parseCssBlock('this is not valid css {{{');
    expect(rules).toHaveLength(0);
  });

  // ── SCSS nesting support ──────────────────────────────────────────

  it('resolves nested selectors as descendant', () => {
    const css = `.card { background: #fff; .title { color: #333; } }`;
    const { rules } = parseCssBlock(css);

    const cardRule = rules.find(r => r.selector === '.card');
    const titleRule = rules.find(r => r.selector === '.card .title');
    expect(cardRule).toBeDefined();
    expect(cardRule!.declarations).toHaveLength(1);
    expect(cardRule!.declarations[0].value).toBe('#fff');
    expect(titleRule).toBeDefined();
    expect(titleRule!.declarations[0].value).toBe('#333');
  });

  it('resolves & parent reference', () => {
    const css = `.btn { color: #fff; &:hover { color: #eee; } &-primary { background: blue; } }`;
    const { rules } = parseCssBlock(css);

    expect(rules.find(r => r.selector === '.btn')).toBeDefined();
    expect(rules.find(r => r.selector === '.btn:hover')).toBeDefined();
    expect(rules.find(r => r.selector === '.btn-primary')).toBeDefined();
  });

  it('resolves multi-level nesting', () => {
    const css = `section { .card { .title { color: red; } } }`;
    const { rules } = parseCssBlock(css);

    expect(rules.find(r => r.selector === 'section .card .title')).toBeDefined();
  });

  it('nested rules do not leak declarations to parent', () => {
    const css = `.card { background: #fff; .title { color: #333; } }`;
    const { rules } = parseCssBlock(css);

    const cardRule = rules.find(r => r.selector === '.card');
    // .card should only have background, NOT the nested .title's color
    expect(cardRule!.declarations).toHaveLength(1);
    expect(cardRule!.declarations[0].property).toBe('background');
  });
});

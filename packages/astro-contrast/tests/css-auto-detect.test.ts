import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseCssBlock } from '../src/parser/css-parser.js';
import { parseAstroFile } from '../src/parser/astro-parser.js';
import { resolveLinkedCss } from '../src/resolver/css-auto-resolver.js';
import { analyzeFile } from '../src/analyzer.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

// ── parseCssBlock @import extraction ────────────────────────────────

describe('parseCssBlock — @import extraction', () => {
  it('returns empty imports for CSS without @import', () => {
    const { imports } = parseCssBlock('.foo { color: red; }');
    expect(imports).toEqual([]);
  });

  it('extracts URL from @import url("file.css")', () => {
    const { imports } = parseCssBlock('@import url("tokens.css");');
    expect(imports).toEqual(['tokens.css']);
  });

  it("extracts URL from @import url('file.css')", () => {
    const { imports } = parseCssBlock("@import url('tokens.css');");
    expect(imports).toEqual(['tokens.css']);
  });

  it('extracts URL from @import url(file.css) (no quotes)', () => {
    const { imports } = parseCssBlock('@import url(tokens.css);');
    expect(imports).toEqual(['tokens.css']);
  });

  it("extracts URL from @import 'file.css'", () => {
    const { imports } = parseCssBlock("@import './base.css';");
    expect(imports).toEqual(['./base.css']);
  });

  it('extracts URL from @import "file.css"', () => {
    const { imports } = parseCssBlock('@import "./base.css";');
    expect(imports).toEqual(['./base.css']);
  });

  it('skips http URLs', () => {
    const { imports } = parseCssBlock('@import url("https://fonts.googleapis.com/css2");');
    expect(imports).toEqual([]);
  });

  it('skips protocol-relative URLs', () => {
    const { imports } = parseCssBlock('@import url("//cdn.example.com/style.css");');
    expect(imports).toEqual([]);
  });

  it('extracts multiple imports', () => {
    const css = `
      @import './tokens.css';
      @import url('base.css');
      .foo { color: red; }
    `;
    const { imports } = parseCssBlock(css);
    expect(imports).toEqual(['./tokens.css', 'base.css']);
  });
});

// ── parseAstroFile — <link> and @import extraction ──────────────────

describe('parseAstroFile — link and import extraction', () => {
  it('extracts <link rel="stylesheet"> hrefs', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'auto-detect.astro'));
    expect(result.linkedCssHrefs).toEqual(['./auto-linked.css']);
  });

  it('extracts @import from <style> blocks', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'auto-detect-import.astro'));
    expect(result.styleImports).toEqual(['./auto-tokens.css']);
  });

  it('extracts CSS imports from frontmatter', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'auto-detect-frontmatter.astro'));
    expect(result.linkedCssHrefs).toContain('./auto-linked.css');
  });

  it('returns empty arrays when no links or imports', async () => {
    const result = await parseAstroFile(join(FIXTURES, 'simple-colors.astro'));
    expect(result.linkedCssHrefs).toEqual([]);
    expect(result.styleImports).toEqual([]);
  });
});

// ── resolveLinkedCss — recursive CSS loading ────────────────────────

describe('resolveLinkedCss', () => {
  it('loads rules from a linked CSS file', async () => {
    const { rules } = await resolveLinkedCss(['./auto-linked.css'], FIXTURES);
    expect(rules.length).toBeGreaterThan(0);
    const heroRule = rules.find(r => r.selector === '.hero');
    expect(heroRule).toBeDefined();
  });

  it('loads custom properties from a linked CSS file', async () => {
    const { customProperties } = await resolveLinkedCss(['./auto-tokens.css'], FIXTURES);
    expect(customProperties.get('--color-primary')).toBe('#1a1a2e');
    expect(customProperties.get('--color-text')).toBe('#ffffff');
  });

  it('skips http URLs', async () => {
    const { rules, customProperties } = await resolveLinkedCss(
      ['https://cdn.example.com/style.css'],
      FIXTURES,
    );
    expect(rules).toEqual([]);
    expect(customProperties.size).toBe(0);
  });

  it('handles non-existent files without crashing', async () => {
    const { rules } = await resolveLinkedCss(['./does-not-exist.css'], FIXTURES);
    expect(rules).toEqual([]);
  });

  it('resolves @import chain recursively (A imports B)', async () => {
    const { rules, customProperties } = await resolveLinkedCss(
      ['./auto-chain-base.css'],
      FIXTURES,
    );

    // From auto-chain-base.css
    const navRule = rules.find(r => r.selector === '.nav');
    expect(navRule).toBeDefined();

    // From auto-chain-leaf.css (imported by auto-chain-base.css)
    const footerRule = rules.find(r => r.selector === '.footer');
    expect(footerRule).toBeDefined();

    // Custom property from the leaf
    expect(customProperties.get('--chain-color')).toBe('#ff6600');
  });

  it('handles circular imports without infinite loop', async () => {
    const { rules } = await resolveLinkedCss(['./auto-circular-a.css'], FIXTURES);

    // Should get rules from both files, but not loop
    const boxA = rules.find(r => r.selector === '.box-a');
    const boxB = rules.find(r => r.selector === '.box-b');
    expect(boxA).toBeDefined();
    expect(boxB).toBeDefined();
  });
});

// ── analyzeFile integration ─────────────────────────────────────────

describe('analyzeFile — auto-detected CSS', () => {
  it('applies rules from <link rel="stylesheet"> automatically', async () => {
    const result = await analyzeFile(join(FIXTURES, 'auto-detect.astro'));

    // Should detect the .hero color pair from auto-linked.css
    const heroResult = result.results.find(
      r => r.element.classes.includes('hero'),
    );
    expect(heroResult).toBeDefined();
    expect(heroResult!.foreground.original).toBe('#ffffff');
    expect(heroResult!.background.original).toBe('#1a1a2e');
  });

  it('resolves custom properties from @import in <style>', async () => {
    const result = await analyzeFile(join(FIXTURES, 'auto-detect-import.astro'));

    // The <p> uses var(--color-text) and var(--color-primary) from imported tokens
    expect(result.results.length).toBeGreaterThan(0);
    const pResult = result.results[0];
    expect(pResult.foreground.rgb).toBeDefined();
    expect(pResult.background.rgb).toBeDefined();
  });

  it('resolves @import chain through <link>', async () => {
    const result = await analyzeFile(join(FIXTURES, 'auto-detect-chain.astro'));

    // .nav comes from auto-chain-base.css
    const navResult = result.results.find(
      r => r.element.classes.includes('nav'),
    );
    expect(navResult).toBeDefined();

    // .footer comes from auto-chain-leaf.css (imported by auto-chain-base.css)
    const footerResult = result.results.find(
      r => r.element.classes.includes('footer'),
    );
    expect(footerResult).toBeDefined();
  });

  it('applies rules from frontmatter import automatically', async () => {
    const result = await analyzeFile(join(FIXTURES, 'auto-detect-frontmatter.astro'));

    const heroResult = result.results.find(
      r => r.element.classes.includes('hero'),
    );
    expect(heroResult).toBeDefined();
    expect(heroResult!.foreground.original).toBe('#ffffff');
    expect(heroResult!.background.original).toBe('#1a1a2e');
  });

  it('auto-detected CSS coexists with manual --css', async () => {
    const externalRules = [{
      selector: '.extra',
      declarations: [{ property: 'color', value: '#000000', resolvedValue: null }],
      ignored: false,
    }];

    const result = await analyzeFile(join(FIXTURES, 'auto-detect.astro'), {
      externalCssRules: externalRules,
    });

    // Auto-detected rules should still apply
    const heroResult = result.results.find(
      r => r.element.classes.includes('hero'),
    );
    expect(heroResult).toBeDefined();
  });
});

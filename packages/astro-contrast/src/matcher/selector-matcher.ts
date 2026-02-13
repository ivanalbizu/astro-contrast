import type { HtmlElementInfo, CssRuleInfo, CssDeclarationInfo, ColorPair, ColorInfo } from '../types/index.js';
import { parseColor } from '../contrast/color-utils.js';
import { resolveTailwindForeground, resolveTailwindBackground } from '../tailwind/tailwind-resolver.js';

// Tailwind text-size classes → pixel values
const TAILWIND_FONT_SIZES: Record<string, string> = {
  'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px',
  'text-lg': '18px', 'text-xl': '20px', 'text-2xl': '24px',
  'text-3xl': '30px', 'text-4xl': '36px', 'text-5xl': '48px',
  'text-6xl': '60px', 'text-7xl': '72px', 'text-8xl': '96px',
  'text-9xl': '128px',
};

// Tailwind font-weight classes → CSS weight values
const TAILWIND_FONT_WEIGHTS: Record<string, string> = {
  'font-thin': '100', 'font-extralight': '200', 'font-light': '300',
  'font-normal': '400', 'font-medium': '500', 'font-semibold': '600',
  'font-bold': '700', 'font-extrabold': '800', 'font-black': '900',
};

// Default browser heading sizes
const HEADING_DEFAULTS: Record<string, { fontSize: string; fontWeight: string }> = {
  h1: { fontSize: '32px', fontWeight: '700' },
  h2: { fontSize: '24px', fontWeight: '700' },
  h3: { fontSize: '18.72px', fontWeight: '700' },
  h4: { fontSize: '16px', fontWeight: '700' },
  h5: { fontSize: '13.28px', fontWeight: '700' },
  h6: { fontSize: '10.72px', fontWeight: '700' },
};

// ── Selector parsing ────────────────────────────────────────────────

interface SelectorPart {
  tagName: string | null;
  classes: string[];
  id: string | null;
  isUniversal: boolean;
}

interface ParsedSelector {
  target: SelectorPart;
  ancestors: Array<{ combinator: string; part: SelectorPart }>;
}

function parseSelectorPart(s: string): SelectorPart | null {
  let trimmed = s.trim();
  if (!trimmed) return null;

  if (trimmed === '*') {
    return { tagName: null, classes: [], id: null, isUniversal: true };
  }

  // Strip pseudo-classes/elements (:hover, ::before, :not(...), etc.)
  trimmed = trimmed.replace(/::?[\w-]+(\([^)]*\))*/g, '').trim();
  if (!trimmed) return null;

  // Strip attribute selectors ([data-x], [type="submit"], etc.)
  trimmed = trimmed.replace(/\[[^\]]*\]/g, '').trim();
  if (!trimmed) return null;

  let tagName: string | null = null;
  const classes: string[] = [];
  let id: string | null = null;

  const tagMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) tagName = tagMatch[1];

  const classMatches = trimmed.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
  for (const match of classMatches) {
    classes.push(match[1]);
  }

  const idMatch = trimmed.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
  if (idMatch) id = idMatch[1];

  if (!tagName && classes.length === 0 && !id) return null;

  return { tagName, classes, id, isUniversal: false };
}

function parseSelector(selector: string): ParsedSelector | null {
  const trimmed = selector.trim();
  if (!trimmed) return null;

  // Tokenize: split into segments and combinators
  const re = /\s*([>+~])\s*|\s+/g;
  const segments: string[] = [];
  const combinators: string[] = [];
  let lastIndex = 0;
  let m;

  while ((m = re.exec(trimmed)) !== null) {
    const seg = trimmed.slice(lastIndex, m.index).trim();
    if (seg) {
      segments.push(seg);
      combinators.push(m[1] || ' '); // explicit combinator or space (descendant)
    }
    lastIndex = re.lastIndex;
  }
  const lastSeg = trimmed.slice(lastIndex).trim();
  if (lastSeg) segments.push(lastSeg);

  if (segments.length === 0) return null;

  const parsedParts: SelectorPart[] = [];
  for (const seg of segments) {
    const part = parseSelectorPart(seg);
    if (!part) return null;
    parsedParts.push(part);
  }

  const target = parsedParts[parsedParts.length - 1];
  const ancestors: Array<{ combinator: string; part: SelectorPart }> = [];
  for (let i = parsedParts.length - 2; i >= 0; i--) {
    ancestors.push({ combinator: combinators[i], part: parsedParts[i] });
  }

  return { target, ancestors };
}

// ── Selector matching ───────────────────────────────────────────────

function matchesPart(element: HtmlElementInfo, part: SelectorPart): boolean {
  if (part.isUniversal) return true;
  if (part.tagName && element.tagName !== part.tagName) return false;
  if (part.id && element.id !== part.id) return false;
  for (const cls of part.classes) {
    if (!element.classes.includes(cls)) return false;
  }
  if (!part.tagName && part.classes.length === 0 && !part.id) return false;
  return true;
}

function matchesSelector(element: HtmlElementInfo, selector: ParsedSelector): boolean {
  if (!matchesPart(element, selector.target)) return false;

  let current: HtmlElementInfo | null | undefined = element;
  for (const { combinator, part } of selector.ancestors) {
    if (combinator === '>') {
      // Child combinator: immediate parent must match
      current = current?.parentElement;
      if (!current || !matchesPart(current, part)) return false;
    } else if (combinator === ' ') {
      // Descendant combinator: any ancestor must match
      current = current?.parentElement;
      let found = false;
      while (current) {
        if (matchesPart(current, part)) { found = true; break; }
        current = current.parentElement;
      }
      if (!found) return false;
    } else {
      // Sibling combinators (+ ~): no sibling info available, skip ancestor check
      break;
    }
  }

  return true;
}

// ── Specificity ─────────────────────────────────────────────────────

function partSpecificity(part: SelectorPart): number {
  let s = 0;
  if (part.isUniversal) return 0;
  if (part.id) s += 100;
  s += part.classes.length * 10;
  if (part.tagName) s += 1;
  return s;
}

function selectorSpecificity(selector: ParsedSelector): number {
  let s = partSpecificity(selector.target);
  for (const { part } of selector.ancestors) {
    s += partSpecificity(part);
  }
  return s;
}

interface MatchedDeclaration {
  declaration: CssDeclarationInfo;
  specificity: number;
  selector: string;
}

function findBestDeclaration(
  element: HtmlElementInfo,
  rules: CssRuleInfo[],
  property: string,
): MatchedDeclaration | null {
  let best: MatchedDeclaration | null = null;

  for (const rule of rules) {
    if (rule.ignored) continue;
    const parsed = parseSelector(rule.selector);
    if (!parsed || !matchesSelector(element, parsed)) continue;

    const spec = selectorSpecificity(parsed);
    for (const decl of rule.declarations) {
      if (decl.property !== property && !(property === 'background-color' && decl.property === 'background')) continue;
      if (!best || spec >= best.specificity) {
        best = { declaration: decl, specificity: spec, selector: rule.selector };
      }
    }
  }

  return best;
}

const ROOT_SELECTORS = new Set(['body', 'html', ':root']);

function findRootBackground(rules: CssRuleInfo[]): ColorInfo | null {
  for (const rule of rules) {
    if (rule.ignored) continue;
    if (!ROOT_SELECTORS.has(rule.selector.trim())) continue;
    for (const decl of rule.declarations) {
      if (decl.property !== 'background-color' && decl.property !== 'background') continue;
      const value = decl.resolvedValue ?? decl.value;
      return {
        original: decl.value,
        rgb: parseColor(value),
        source: 'stylesheet',
        selector: `inherited:${rule.selector.trim()}`,
      };
    }
  }
  return null;
}

function findAncestorBackground(element: HtmlElementInfo, rules: CssRuleInfo[]): ColorInfo | null {
  let ancestor = element.parentElement;
  while (ancestor) {
    // Check inline styles
    if (ancestor.inlineStyles?.backgroundColor) {
      return {
        original: ancestor.inlineStyles.backgroundColor,
        rgb: parseColor(ancestor.inlineStyles.backgroundColor),
        source: 'inline',
        selector: `inherited:${ancestor.tagName}`,
      };
    }

    // Check Tailwind bg classes
    const twBg = resolveTailwindBackground(ancestor.classes);
    if (twBg) {
      return {
        original: twBg.className,
        rgb: parseColor(twBg.value),
        source: 'stylesheet',
        selector: `inherited:${twBg.className}`,
      };
    }

    // Check CSS rules
    const match = findBestDeclaration(ancestor, rules, 'background-color');
    if (match) {
      const value = match.declaration.resolvedValue ?? match.declaration.value;
      return {
        original: match.declaration.value,
        rgb: parseColor(value),
        source: 'stylesheet',
        selector: `inherited:${match.selector}`,
      };
    }

    ancestor = ancestor.parentElement;
  }
  return null;
}

export function buildColorPairs(
  elements: HtmlElementInfo[],
  rules: CssRuleInfo[],
): ColorPair[] {
  const pairs: ColorPair[] = [];

  for (const element of elements) {
    if (!element.hasTextContent) continue;
    if (element.ignored) continue;

    let fgColor: ColorInfo | null = null;
    let bgColor: ColorInfo | null = null;

    // Check inline styles first (highest priority)
    if (element.inlineStyles?.color) {
      fgColor = {
        original: element.inlineStyles.color,
        rgb: parseColor(element.inlineStyles.color),
        source: 'inline',
        selector: 'inline',
      };
    }
    if (element.inlineStyles?.backgroundColor) {
      bgColor = {
        original: element.inlineStyles.backgroundColor,
        rgb: parseColor(element.inlineStyles.backgroundColor),
        source: 'inline',
        selector: 'inline',
      };
    }

    // Check Tailwind utility classes
    if (!fgColor) {
      const twFg = resolveTailwindForeground(element.classes);
      if (twFg) {
        fgColor = {
          original: twFg.className,
          rgb: parseColor(twFg.value),
          source: 'stylesheet',
          selector: twFg.className,
        };
      }
    }
    if (!bgColor) {
      const twBg = resolveTailwindBackground(element.classes);
      if (twBg) {
        bgColor = {
          original: twBg.className,
          rgb: parseColor(twBg.value),
          source: 'stylesheet',
          selector: twBg.className,
        };
      }
    }

    // Then check stylesheet rules
    if (!fgColor) {
      const match = findBestDeclaration(element, rules, 'color');
      if (match) {
        const value = match.declaration.resolvedValue ?? match.declaration.value;
        fgColor = {
          original: match.declaration.value,
          rgb: parseColor(value),
          source: 'stylesheet',
          selector: match.selector,
        };
      }
    }

    if (!bgColor) {
      const match = findBestDeclaration(element, rules, 'background-color');
      if (match) {
        const value = match.declaration.resolvedValue ?? match.declaration.value;
        bgColor = {
          original: match.declaration.value,
          rgb: parseColor(value),
          source: 'stylesheet',
          selector: match.selector,
        };
      }
    }

    // Only create a pair if we have at least one explicit color
    if (!fgColor && !bgColor) continue;

    // Defaults: black text on white background
    if (!fgColor) {
      fgColor = {
        original: '#000000 (assumed)',
        rgb: { r: 0, g: 0, b: 0 },
        source: 'stylesheet',
        selector: '(default)',
      };
    }
    if (!bgColor) {
      bgColor = findAncestorBackground(element, rules)
        ?? findRootBackground(rules)
        ?? {
          original: '#ffffff (assumed)',
          rgb: { r: 255, g: 255, b: 255 },
          source: 'stylesheet',
          selector: '(default)',
        };
    }

    // Composite semi-transparent backgrounds onto the surface behind them
    if (bgColor.rgb && bgColor.rgb.a !== undefined && bgColor.rgb.a < 1) {
      const behind = findAncestorBackground(element, rules)
        ?? findRootBackground(rules)
        ?? { rgb: { r: 255, g: 255, b: 255 } };
      if (behind.rgb) {
        const a = bgColor.rgb.a;
        bgColor = {
          ...bgColor,
          rgb: {
            r: Math.round(bgColor.rgb.r * a + behind.rgb.r * (1 - a)),
            g: Math.round(bgColor.rgb.g * a + behind.rgb.g * (1 - a)),
            b: Math.round(bgColor.rgb.b * a + behind.rgb.b * (1 - a)),
          },
        };
      }
    }

    // Resolve font-size: inline > Tailwind > CSS rules > heading defaults
    let fontSize: string | null = element.inlineStyles?.fontSize ?? null;
    if (!fontSize) {
      for (const cls of element.classes) {
        if (TAILWIND_FONT_SIZES[cls]) { fontSize = TAILWIND_FONT_SIZES[cls]; break; }
      }
    }
    if (!fontSize) {
      const match = findBestDeclaration(element, rules, 'font-size');
      if (match) fontSize = match.declaration.resolvedValue ?? match.declaration.value;
    }
    if (!fontSize && HEADING_DEFAULTS[element.tagName]) {
      fontSize = HEADING_DEFAULTS[element.tagName].fontSize;
    }

    // Resolve font-weight: inline > Tailwind > CSS rules > heading defaults
    let fontWeight: string | null = element.inlineStyles?.fontWeight ?? null;
    if (!fontWeight) {
      for (const cls of element.classes) {
        if (TAILWIND_FONT_WEIGHTS[cls]) { fontWeight = TAILWIND_FONT_WEIGHTS[cls]; break; }
      }
    }
    if (!fontWeight) {
      const match = findBestDeclaration(element, rules, 'font-weight');
      if (match) fontWeight = match.declaration.resolvedValue ?? match.declaration.value;
    }
    if (!fontWeight && HEADING_DEFAULTS[element.tagName]) {
      fontWeight = HEADING_DEFAULTS[element.tagName].fontWeight;
    }

    pairs.push({ element, foreground: fgColor, background: bgColor, fontSize, fontWeight });
  }

  return pairs;
}

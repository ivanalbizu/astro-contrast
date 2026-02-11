import type { ContrastResult, IgnoreConfig, RgbColor } from '../types/index.js';
import { parseColor } from '../contrast/color-utils.js';

interface ParsedIgnoreConfig {
  colors: RgbColor[];
  pairs: Array<{ foreground: RgbColor; background: RgbColor }>;
  selectorMatchers: Array<(result: ContrastResult) => boolean>;
}

function rgbEquals(a: RgbColor, b: RgbColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && (a.a ?? 1) === (b.a ?? 1);
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function buildSelectorMatcher(selector: string): (result: ContrastResult) => boolean {
  const trimmed = selector.trim();

  // Tag name: "p", "span", "h1"
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(trimmed)) {
    return (r) => r.element.tagName === trimmed;
  }

  // ID: "#logo"
  if (trimmed.startsWith('#')) {
    const id = trimmed.slice(1);
    if (id.includes('*')) {
      const regex = wildcardToRegex(id);
      return (r) => r.element.id !== null && regex.test(r.element.id);
    }
    return (r) => r.element.id === id;
  }

  // Class: ".brand-badge", ".alert-*"
  if (trimmed.startsWith('.')) {
    const cls = trimmed.slice(1);
    if (cls.includes('*')) {
      const regex = wildcardToRegex(cls);
      return (r) => r.element.classes.some(c => regex.test(c));
    }
    return (r) => r.element.classes.includes(cls);
  }

  // Fallback: no match
  return () => false;
}

export function parseIgnoreConfig(config: IgnoreConfig | undefined): ParsedIgnoreConfig | null {
  if (!config) return null;

  const colors: RgbColor[] = [];
  for (const raw of config.colors ?? []) {
    const rgb = parseColor(raw);
    if (rgb) colors.push(rgb);
  }

  const pairs: ParsedIgnoreConfig['pairs'] = [];
  for (const pair of config.pairs ?? []) {
    const fg = parseColor(pair.foreground);
    const bg = parseColor(pair.background);
    if (fg && bg) pairs.push({ foreground: fg, background: bg });
  }

  const selectorMatchers: ParsedIgnoreConfig['selectorMatchers'] = [];
  for (const sel of config.selectors ?? []) {
    selectorMatchers.push(buildSelectorMatcher(sel));
  }

  const hasRules = colors.length > 0 || pairs.length > 0 || selectorMatchers.length > 0;
  return hasRules ? { colors, pairs, selectorMatchers } : null;
}

export function shouldIgnoreResult(result: ContrastResult, parsed: ParsedIgnoreConfig): boolean {
  for (const rgb of parsed.colors) {
    if (
      (result.foreground.rgb && rgbEquals(result.foreground.rgb, rgb)) ||
      (result.background.rgb && rgbEquals(result.background.rgb, rgb))
    ) {
      return true;
    }
  }

  for (const pair of parsed.pairs) {
    if (
      result.foreground.rgb && result.background.rgb &&
      rgbEquals(result.foreground.rgb, pair.foreground) &&
      rgbEquals(result.background.rgb, pair.background)
    ) {
      return true;
    }
  }

  for (const matches of parsed.selectorMatchers) {
    if (matches(result)) return true;
  }

  return false;
}

export function applyIgnoreFilter(
  results: ContrastResult[],
  config: IgnoreConfig | undefined,
): ContrastResult[] {
  const parsed = parseIgnoreConfig(config);
  if (!parsed) return results;
  return results.filter(r => !shouldIgnoreResult(r, parsed));
}

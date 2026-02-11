import { defaultPalette } from './default-palette.js';

export interface TailwindColorResult {
  property: 'color' | 'background-color';
  value: string;
  className: string;
}

// text-blue-500, bg-red-600, text-white, bg-black
const UTILITY_RE = /^(text|bg)-(.+)$/;

// Arbitrary value: text-[#1a5276], bg-[rgb(26,82,118)]
const ARBITRARY_RE = /^(text|bg)-\[(.+)\]$/;

// Non-color text/bg utilities to skip
const SKIP_UTILITIES = new Set([
  // text- utilities that are NOT colors
  'text-left', 'text-center', 'text-right', 'text-justify', 'text-start', 'text-end',
  'text-wrap', 'text-nowrap', 'text-balance', 'text-pretty',
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
  'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
  'text-7xl', 'text-8xl', 'text-9xl',
  'text-ellipsis', 'text-clip',
  // bg- utilities that are NOT colors
  'bg-fixed', 'bg-local', 'bg-scroll',
  'bg-auto', 'bg-cover', 'bg-contain',
  'bg-center', 'bg-top', 'bg-bottom', 'bg-left', 'bg-right',
  'bg-repeat', 'bg-no-repeat', 'bg-repeat-x', 'bg-repeat-y', 'bg-repeat-round', 'bg-repeat-space',
  'bg-clip-border', 'bg-clip-padding', 'bg-clip-content', 'bg-clip-text',
  'bg-origin-border', 'bg-origin-padding', 'bg-origin-content',
  'bg-none',
]);

function lookupPaletteColor(colorPart: string): string | null {
  // Direct color (white, black)
  const direct = defaultPalette[colorPart];
  if (typeof direct === 'string') return direct;

  // color-shade pattern (blue-500)
  const lastDash = colorPart.lastIndexOf('-');
  if (lastDash === -1) return null;

  const family = colorPart.substring(0, lastDash);
  const shade = colorPart.substring(lastDash + 1);

  const familyColors = defaultPalette[family];
  if (typeof familyColors === 'object') {
    return familyColors[shade] ?? null;
  }

  return null;
}

export function resolveTailwindColor(className: string): TailwindColorResult | null {
  if (SKIP_UTILITIES.has(className)) return null;

  // Arbitrary value: text-[#hex], bg-[rgb(...)]
  const arbMatch = className.match(ARBITRARY_RE);
  if (arbMatch) {
    const [, prefix, rawValue] = arbMatch;
    const property = prefix === 'text' ? 'color' : 'background-color';
    return { property, value: rawValue, className };
  }

  // Standard utility: text-blue-500, bg-white
  const utilMatch = className.match(UTILITY_RE);
  if (!utilMatch) return null;

  const [, prefix, colorPart] = utilMatch;
  const property = prefix === 'text' ? 'color' : 'background-color';

  const hex = lookupPaletteColor(colorPart);
  if (!hex) return null;

  return { property, value: hex, className };
}

export function resolveTailwindForeground(classes: string[]): TailwindColorResult | null {
  // Last matching class wins (Tailwind specificity)
  let result: TailwindColorResult | null = null;
  for (const cls of classes) {
    const resolved = resolveTailwindColor(cls);
    if (resolved?.property === 'color') {
      result = resolved;
    }
  }
  return result;
}

export function resolveTailwindBackground(classes: string[]): TailwindColorResult | null {
  let result: TailwindColorResult | null = null;
  for (const cls of classes) {
    const resolved = resolveTailwindColor(cls);
    if (resolved?.property === 'background-color') {
      result = resolved;
    }
  }
  return result;
}

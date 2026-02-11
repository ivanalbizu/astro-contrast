import type { RgbColor } from '../types/index.js';
import { contrastRatio } from './calculator.js';

export interface WcagEvaluation {
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  level: 'pass' | 'aa-fail' | 'aaa-only';
  isLargeText: boolean;
}

export interface TextSizeOptions {
  fontSize?: string | null;
  fontWeight?: string | null;
}

// WCAG 2.1 thresholds
const AA_NORMAL = 4.5;
const AAA_NORMAL = 7;
const AA_LARGE = 3;
const AAA_LARGE = 4.5;

function parseFontSizePx(fontSize: string): number | null {
  const trimmed = fontSize.trim().toLowerCase();
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(px|pt|rem|em|%)?$/);
  if (!m) return null;

  const value = parseFloat(m[1]);
  const unit = m[2] || 'px';

  switch (unit) {
    case 'px': return value;
    case 'pt': return value * (4 / 3); // 1pt = 1.333px
    case 'rem':
    case 'em': return value * 16; // assume 16px base
    case '%': return value * 0.16; // % of 16px
    default: return null;
  }
}

function parseFontWeightNumeric(fontWeight: string): number {
  const trimmed = fontWeight.trim().toLowerCase();
  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) return num;

  switch (trimmed) {
    case 'bold':
    case 'bolder': return 700;
    case 'normal':
    case 'lighter': return 400;
    default: return 400;
  }
}

export function isLargeText(fontSize: string | null, fontWeight: string | null): boolean {
  if (!fontSize) return false;

  const px = parseFontSizePx(fontSize);
  if (px === null) return false;

  // WCAG: >= 18px is large text, or >= 14px if bold (>= 700)
  if (px >= 18) return true;

  if (px >= 14) {
    const weight = fontWeight ? parseFontWeightNumeric(fontWeight) : 400;
    return weight >= 700;
  }

  return false;
}

export function evaluateContrast(
  foreground: RgbColor,
  background: RgbColor,
  options?: TextSizeOptions,
): WcagEvaluation {
  const ratio = contrastRatio(foreground, background);
  const largeText = isLargeText(options?.fontSize ?? null, options?.fontWeight ?? null);

  const aaThreshold = largeText ? AA_LARGE : AA_NORMAL;
  const aaaThreshold = largeText ? AAA_LARGE : AAA_NORMAL;

  const meetsAA = ratio >= aaThreshold;
  const meetsAAA = ratio >= aaaThreshold;

  let level: WcagEvaluation['level'];
  if (meetsAAA) {
    level = 'pass';
  } else if (meetsAA) {
    level = 'aaa-only';
  } else {
    level = 'aa-fail';
  }

  return { ratio, meetsAA, meetsAAA, level, isLargeText: largeText };
}

import type { RgbColor } from '../types/index.js';

const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff',
  aquamarine: '#7fffd4', azure: '#f0ffff', beige: '#f5f5dc',
  bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd',
  blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc', crimson: '#dc143c', cyan: '#00ffff',
  darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
  darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000',
  darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1',
  darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff',
  dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff',
  firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff',
  gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
  green: '#008000', greenyellow: '#adff2f', grey: '#808080',
  honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c',
  lavender: '#e6e6fa', lavenderblush: '#fff0f5', lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
  lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa',
  lightslategray: '#778899', lightslategrey: '#778899', lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000',
  mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
  oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23',
  orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9',
  peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
  powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1',
  saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
  seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d',
  silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa',
  springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c',
  teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
  turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

function parseAlphaValue(raw: string): number {
  const s = raw.trim();
  if (s.endsWith('%')) return parseFloat(s) / 100;
  return parseFloat(s);
}

function parseHex(hex: string): RgbColor | null {
  let h = hex.replace('#', '');

  // Expand shorthand (3 or 4 digits)
  if (h.length === 3 || h.length === 4) {
    h = h.split('').map(c => c + c).join('');
  }

  if (h.length !== 6 && h.length !== 8) return null;

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  if (h.length === 8) {
    const a = parseInt(h.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }

  return { r, g, b };
}

function parseRgb(value: string): RgbColor | null {
  // Matches rgb(r, g, b), rgba(r, g, b, a), rgb(r g b), rgb(r g b / a)
  const match = value.match(
    /rgba?\(\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)(?:\s*[,/]\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!match) return null;

  const r = Math.round(Math.min(255, Math.max(0, parseFloat(match[1]))));
  const g = Math.round(Math.min(255, Math.max(0, parseFloat(match[2]))));
  const b = Math.round(Math.min(255, Math.max(0, parseFloat(match[3]))));

  if (match[4]) {
    const a = parseAlphaValue(match[4]);
    return { r, g, b, a };
  }
  return { r, g, b };
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function parseHsl(value: string): RgbColor | null {
  // Matches hsl(h, s%, l%), hsla(h, s%, l%, a), hsl(h s% l%), hsl(h s% l% / a)
  const match = value.match(
    /hsla?\(\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)%\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)%(?:\s*[,/]\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!match) return null;

  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  const alpha = match[4] ? parseAlphaValue(match[4]) : undefined;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return alpha !== undefined ? { r: gray, g: gray, b: gray, a: alpha } : { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const result: RgbColor = {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
  if (alpha !== undefined) result.a = alpha;
  return result;
}

// ── Modern color helpers ────────────────────────────────────────────

function clampByte(v: number): number {
  return Math.round(Math.min(255, Math.max(0, v)));
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function parseAngle(s: string): number {
  const m = s.match(/^(-?\d+(?:\.\d+)?)(deg|rad|grad|turn)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  switch (m[2]) {
    case 'rad':  return v * (180 / Math.PI);
    case 'grad': return v * 0.9;
    case 'turn': return v * 360;
    default:     return v; // deg or no unit
  }
}

// OKLab → linear sRGB (Björn Ottosson)
function oklabToRgb(L: number, a: number, b: number): RgbColor {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return {
    r: clampByte(linearToSrgb(rLin) * 255),
    g: clampByte(linearToSrgb(gLin) * 255),
    b: clampByte(linearToSrgb(bLin) * 255),
  };
}

// CIE Lab → XYZ D65 → linear sRGB → sRGB
const XN = 0.95047;
const ZN = 1.08883;
const LAB_E = 0.008856;
const LAB_K = 903.3;

function labToRgb(L: number, a: number, b: number): RgbColor {
  // Lab → XYZ
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;

  const x = (fx3 > LAB_E ? fx3 : (116 * fx - 16) / LAB_K) * XN;
  const y = L > LAB_K * LAB_E ? Math.pow((L + 16) / 116, 3) : L / LAB_K;
  const z = (fz3 > LAB_E ? fz3 : (116 * fz - 16) / LAB_K) * ZN;

  // XYZ → linear sRGB (D65)
  const rLin = +3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gLin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const bLin = +0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return {
    r: clampByte(linearToSrgb(rLin) * 255),
    g: clampByte(linearToSrgb(gLin) * 255),
    b: clampByte(linearToSrgb(bLin) * 255),
  };
}

// number that may have optional % suffix – used by oklab/oklch L component
function parseLightness(s: string, max: number): number {
  if (s.endsWith('%')) return (parseFloat(s) / 100) * max;
  return parseFloat(s);
}

function parseOklab(value: string): RgbColor | null {
  const m = value.match(
    /oklab\(\s*(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?%?)(?:\s*\/\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!m) return null;

  const L = parseLightness(m[1], 1);
  const a = m[2].endsWith('%') ? parseFloat(m[2]) / 100 * 0.4 : parseFloat(m[2]);
  const b = m[3].endsWith('%') ? parseFloat(m[3]) / 100 * 0.4 : parseFloat(m[3]);

  if (isNaN(L) || isNaN(a) || isNaN(b)) return null;
  const result = oklabToRgb(L, a, b);
  if (m[4]) result.a = parseAlphaValue(m[4]);
  return result;
}

function parseOklch(value: string): RgbColor | null {
  const m = value.match(
    /oklch\(\s*(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?(?:deg|rad|grad|turn)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!m) return null;

  const L = parseLightness(m[1], 1);
  const C = m[2].endsWith('%') ? parseFloat(m[2]) / 100 * 0.4 : parseFloat(m[2]);
  const H = parseAngle(m[3]);

  if (isNaN(L) || isNaN(C) || isNaN(H)) return null;

  const hRad = H * (Math.PI / 180);
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const result = oklabToRgb(L, a, b);
  if (m[4]) result.a = parseAlphaValue(m[4]);
  return result;
}

function parseCieLab(value: string): RgbColor | null {
  const m = value.match(
    /lab\(\s*(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!m) return null;

  const L = parseLightness(m[1], 100);
  const a = parseFloat(m[2]);
  const b = parseFloat(m[3]);

  if (isNaN(L) || isNaN(a) || isNaN(b)) return null;
  const result = labToRgb(L, a, b);
  if (m[4]) result.a = parseAlphaValue(m[4]);
  return result;
}

function parseCieLch(value: string): RgbColor | null {
  const m = value.match(
    /lch\(\s*(-?\d+(?:\.\d+)?%?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?(?:deg|rad|grad|turn)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?%?))?\s*\)/
  );
  if (!m) return null;

  const L = parseLightness(m[1], 100);
  const C = parseFloat(m[2]);
  const H = parseAngle(m[3]);

  if (isNaN(L) || isNaN(C) || isNaN(H)) return null;

  const hRad = H * (Math.PI / 180);
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const result = labToRgb(L, a, b);
  if (m[4]) result.a = parseAlphaValue(m[4]);
  return result;
}

// ── Main entry point ────────────────────────────────────────────────

export function parseColor(value: string): RgbColor | null {
  const trimmed = value.trim().toLowerCase();

  if (trimmed === 'transparent') return null;

  // Named color
  if (NAMED_COLORS[trimmed]) {
    return parseHex(NAMED_COLORS[trimmed]);
  }

  // Hex
  if (trimmed.startsWith('#')) {
    return parseHex(trimmed);
  }

  // RGB/RGBA
  if (trimmed.startsWith('rgb')) {
    return parseRgb(trimmed);
  }

  // HSL/HSLA
  if (trimmed.startsWith('hsl')) {
    return parseHsl(trimmed);
  }

  // OKLab / OKLCH (must check before lab/lch)
  if (trimmed.startsWith('oklch')) {
    return parseOklch(trimmed);
  }
  if (trimmed.startsWith('oklab')) {
    return parseOklab(trimmed);
  }

  // CIE Lab / LCH
  if (trimmed.startsWith('lch')) {
    return parseCieLch(trimmed);
  }
  if (trimmed.startsWith('lab')) {
    return parseCieLab(trimmed);
  }

  return null;
}

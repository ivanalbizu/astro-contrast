import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import postcss from 'postcss';
import { parse as parseYaml } from 'yaml';

interface TokenNode {
  $value?: unknown;
  $type?: string;
  value?: unknown;
  type?: string;
  [key: string]: unknown;
}

interface FlatToken {
  path: string;
  value: string;
}

function isTokenNode(node: unknown): node is TokenNode {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
  return '$value' in node || 'value' in node;
}

function extractColorValue(value: unknown): string | null {
  if (typeof value === 'string') return value;

  // DTCG color space object: { colorSpace: "srgb", components: [r, g, b], hex: "#..." }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.hex === 'string') return obj.hex;

    if (obj.colorSpace === 'srgb' && Array.isArray(obj.components)) {
      const [r, g, b] = obj.components as number[];
      const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }

  return null;
}

function flattenTokens(
  obj: Record<string, unknown>,
  path: string[] = [],
): FlatToken[] {
  const tokens: FlatToken[] = [];

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;

    const currentPath = [...path, key];

    if (isTokenNode(val)) {
      const rawValue = val.$value ?? val.value;
      const tokenType = val.$type ?? val.type;

      // Only extract color tokens (or tokens without explicit type that have color-like values)
      const isColor = tokenType === 'color' || (!tokenType && isColorLikeValue(rawValue));
      if (!isColor) continue;

      const colorValue = extractColorValue(rawValue);
      if (colorValue) {
        tokens.push({
          path: currentPath.join('.'),
          value: colorValue,
        });
      }
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      // Inherit $type from parent group
      const group = val as Record<string, unknown>;
      if (group.$type === 'color' || !group.$type) {
        tokens.push(...flattenTokens(group, currentPath));
      }
    }
  }

  return tokens;
}

function isColorLikeValue(value: unknown): boolean {
  if (typeof value !== 'string') return typeof value === 'object' && value !== null;
  return /^(#|rgb|hsl|hwb)/.test(value.trim()) ||
    /^\{.*\}$/.test(value.trim());
}

function resolveTokenReferences(
  tokens: FlatToken[],
): FlatToken[] {
  const tokenMap = new Map(tokens.map(t => [t.path, t.value]));
  const maxDepth = 10;

  function resolve(value: string, depth: number): string {
    if (depth >= maxDepth) return value;
    const refMatch = value.match(/^\{(.+)\}$/);
    if (!refMatch) return value;

    const refPath = refMatch[1];
    const resolved = tokenMap.get(refPath);
    if (!resolved) return value;

    return resolve(resolved, depth + 1);
  }

  return tokens.map(t => ({
    path: t.path,
    value: resolve(t.value, 0),
  }));
}

function tokenPathToCssVar(path: string): string {
  return `--${path.replace(/\./g, '-')}`;
}

function parseStructuredTokens(data: Record<string, unknown>): Map<string, string> {
  const flat = flattenTokens(data);
  const resolved = resolveTokenReferences(flat);

  const result = new Map<string, string>();
  for (const token of resolved) {
    result.set(tokenPathToCssVar(token.path), token.value);
  }
  return result;
}

function parseCssTokens(content: string): Map<string, string> {
  const result = new Map<string, string>();

  try {
    const root = postcss.parse(content);
    root.walkRules((rule) => {
      if (rule.selector === ':root' || rule.selector === 'html') {
        rule.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) {
            result.set(decl.prop, decl.value);
          }
        });
      }
    });
  } catch {
    // Invalid CSS
  }

  return result;
}

export async function readTokenFile(filePath: string): Promise<Map<string, string>> {
  const content = await readFile(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.css') {
    return parseCssTokens(content);
  }

  if (ext === '.yaml' || ext === '.yml') {
    return parseStructuredTokens(parseYaml(content));
  }

  // .json, .tokens.json, .tokens — all treated as JSON
  return parseStructuredTokens(JSON.parse(content));
}

export async function readTokenFiles(filePaths: string[]): Promise<Map<string, string>> {
  const merged = new Map<string, string>();

  for (const filePath of filePaths) {
    const tokens = await readTokenFile(filePath);
    for (const [key, value] of tokens) {
      merged.set(key, value);
    }
  }

  return merged;
}

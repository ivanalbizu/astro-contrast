import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseCssBlock } from '../parser/css-parser.js';
import type { CssRuleInfo } from '../types/index.js';

export async function resolveLinkedCss(
  hrefs: string[],
  baseDir: string,
  visited?: Set<string>,
): Promise<{ rules: CssRuleInfo[]; customProperties: Map<string, string> }> {
  const allRules: CssRuleInfo[] = [];
  const allProperties = new Map<string, string>();
  const seen = visited ?? new Set<string>();

  for (const href of hrefs) {
    // Skip absolute/external URLs
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      continue;
    }

    const absPath = resolve(baseDir, href);

    // Circular import protection
    if (seen.has(absPath)) continue;
    seen.add(absPath);

    let content: string;
    try {
      content = await readFile(absPath, 'utf-8');
    } catch {
      // File not found or unreadable — skip silently
      continue;
    }

    const { rules, customProperties, imports } = parseCssBlock(content);

    allRules.push(...rules);
    for (const [k, v] of customProperties) {
      allProperties.set(k, v);
    }

    // Recurse into @import references
    if (imports.length > 0) {
      const nested = await resolveLinkedCss(imports, dirname(absPath), seen);
      allRules.push(...nested.rules);
      for (const [k, v] of nested.customProperties) {
        allProperties.set(k, v);
      }
    }
  }

  return { rules: allRules, customProperties: allProperties };
}

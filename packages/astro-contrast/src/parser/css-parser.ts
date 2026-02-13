import postcss from 'postcss';
import type { CssRuleInfo, CssDeclarationInfo } from '../types/index.js';

const COLOR_PROPERTIES = new Set([
  'color',
  'background-color',
  'background',
]);

const TYPOGRAPHY_PROPERTIES = new Set([
  'font-size',
  'font-weight',
]);

const IGNORE_COMMENT = /^\s*astro-contrast-ignore\s*$/;

function hasPrecedingIgnoreComment(node: postcss.ChildNode): boolean {
  const prev = node.prev();
  return prev?.type === 'comment' && IGNORE_COMMENT.test(prev.text);
}

interface CssParseResult {
  rules: CssRuleInfo[];
  customProperties: Map<string, string>;
  imports: string[];
}

function parseImportUrl(params: string): string | null {
  // url('path.css'), url("path.css"), url(path.css)
  let url = params.replace(/^url\(\s*['"]?|['"]?\s*\)$/g, '').trim();
  // 'path.css', "path.css"
  url = url.replace(/^['"]|['"]$/g, '').trim();
  // Skip external URLs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return null;
  return url || null;
}

function resolveNestedSelector(rule: postcss.Rule): string {
  let selector = rule.selector;
  let parent = rule.parent;

  while (parent && parent.type === 'rule') {
    const parentSelector = (parent as postcss.Rule).selector;
    if (selector.includes('&')) {
      selector = selector.replace(/&/g, parentSelector);
    } else {
      selector = `${parentSelector} ${selector}`;
    }
    parent = parent.parent;
  }

  return selector;
}

export function parseCssBlock(cssContent: string): CssParseResult {
  const rules: CssRuleInfo[] = [];
  const customProperties = new Map<string, string>();

  if (!cssContent.trim()) {
    return { rules, customProperties, imports: [] };
  }

  const imports: string[] = [];

  let root: postcss.Root;
  try {
    root = postcss.parse(cssContent);
  } catch {
    return { rules, customProperties, imports };
  }

  root.walkAtRules('import', (rule) => {
    const url = parseImportUrl(rule.params);
    if (url) imports.push(url);
  });

  root.walkRules((rule) => {
    // Resolve nested selectors (SCSS nesting: .card { .title { } } → .card .title)
    const fullSelector = resolveNestedSelector(rule);

    // Extract custom properties from :root or html
    if (fullSelector === ':root' || fullSelector === 'html') {
      rule.each((child) => {
        if (child.type === 'decl' && child.prop.startsWith('--')) {
          customProperties.set(child.prop, child.value);
        }
      });
    }

    // Extract color and typography declarations (direct children only, not nested rules)
    const declarations: CssDeclarationInfo[] = [];
    rule.each((child) => {
      if (child.type !== 'decl') return;
      const decl = child as postcss.Declaration;
      if (COLOR_PROPERTIES.has(decl.prop)) {
        // For background shorthand, skip non-color values
        if (decl.prop === 'background') {
          if (decl.value.includes('url(') || decl.value.includes('gradient')) {
            return;
          }
        }
        declarations.push({
          property: decl.prop,
          value: decl.value,
          resolvedValue: null,
        });
      }
      if (TYPOGRAPHY_PROPERTIES.has(decl.prop)) {
        declarations.push({
          property: decl.prop,
          value: decl.value,
          resolvedValue: null,
        });
      }
    });

    if (declarations.length > 0) {
      const ignored = hasPrecedingIgnoreComment(rule);
      // Split compound selectors (e.g., ".btn, .link" -> [".btn", ".link"])
      const selectors = fullSelector.split(',').map((s: string) => s.trim());
      for (const selector of selectors) {
        rules.push({ selector, declarations: [...declarations], ignored });
      }
    }
  });

  return { rules, customProperties, imports };
}

import { readFile } from 'node:fs/promises';
import { parse } from '@astrojs/compiler';
import { is } from '@astrojs/compiler/utils';
import type { Node, ElementNode, TagLikeNode } from '@astrojs/compiler/types';
import type { HtmlElementInfo, InlineStyleInfo, ParsedAstroFile } from '../types/index.js';
import { parseCssBlock } from './css-parser.js';

const IGNORE_COMMENT = /^\s*astro-contrast-ignore\s*$/;

function findPrevSignificantSibling(children: Node[], index: number): Node | null {
  for (let i = index - 1; i >= 0; i--) {
    const node = children[i];
    // Skip whitespace-only text nodes
    if (node.type === 'text') {
      const value = (node as { type: 'text'; value: string }).value;
      if (!value.trim()) continue;
    }
    return node;
  }
  return null;
}

function walkRecursive(
  node: { children?: Node[] },
  callback: (node: Node, prevSibling: Node | null, parentElement: HtmlElementInfo | null) => HtmlElementInfo | null,
  parentElement: HtmlElementInfo | null = null,
): void {
  if (!node.children) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const prev = findPrevSignificantSibling(node.children, i);
    const elementInfo = callback(child, prev, parentElement);
    const nextParent = elementInfo ?? parentElement;
    if ('children' in child && Array.isArray((child as { children?: Node[] }).children)) {
      walkRecursive(child as { children: Node[] }, callback, nextParent);
    }
  }
}

function isIgnoreComment(node: Node | null): boolean {
  if (!node || node.type !== 'comment') return false;
  const value = (node as { type: 'comment'; value: string }).value;
  return IGNORE_COMMENT.test(value);
}

function hasIgnoreAttribute(node: TagLikeNode): boolean {
  return node.attributes.some(a => a.name === 'data-contrast-ignore');
}

const IGNORED_TAGS = new Set([
  'script', 'style', 'head', 'meta', 'link', 'title', 'base', 'br', 'hr',
  'img', 'input', 'svg', 'path', 'circle', 'rect', 'line', 'polyline',
  'polygon', 'ellipse',
]);

function extractClasses(node: TagLikeNode): string[] {
  const classAttr = node.attributes.find(a => a.name === 'class');
  if (!classAttr || classAttr.kind === 'expression') return [];
  return classAttr.value.split(/\s+/).filter(Boolean);
}

function extractId(node: TagLikeNode): string | null {
  const idAttr = node.attributes.find(a => a.name === 'id');
  if (!idAttr || idAttr.kind === 'expression') return null;
  return idAttr.value || null;
}

function extractInlineStyles(node: TagLikeNode): InlineStyleInfo | null {
  const styleAttr = node.attributes.find(a => a.name === 'style');
  if (!styleAttr || styleAttr.kind === 'expression') return null;

  const raw = styleAttr.value;
  let color: string | null = null;
  let backgroundColor: string | null = null;
  let fontSize: string | null = null;
  let fontWeight: string | null = null;

  const declarations = raw.split(';').map(d => d.trim()).filter(Boolean);
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.substring(0, colonIdx).trim().toLowerCase();
    const val = decl.substring(colonIdx + 1).trim();

    if (prop === 'color') color = val;
    if (prop === 'background-color') backgroundColor = val;
    if (prop === 'background' && !val.includes('url(') && !val.includes('gradient')) {
      backgroundColor = val;
    }
    if (prop === 'font-size') fontSize = val;
    if (prop === 'font-weight') fontWeight = val;
  }

  if (!color && !backgroundColor && !fontSize && !fontWeight) return null;
  return { color, backgroundColor, fontSize, fontWeight };
}

function hasTextContent(node: TagLikeNode): boolean {
  if (!('children' in node)) return false;
  return node.children.some((child: Node) => {
    if (child.type === 'text') {
      return (child as { type: 'text'; value: string }).value.trim().length > 0;
    }
    // Expression nodes might contain text
    if (child.type === 'expression') return true;
    // Child elements might contain text
    if (child.type === 'element' || child.type === 'component') return true;
    return false;
  });
}

function extractStyleContent(node: ElementNode): string | null {
  if (node.name !== 'style') return null;
  if (!node.children.length) return null;

  const textChild = node.children.find((c: Node) => c.type === 'text');
  if (!textChild) return null;

  return (textChild as { type: 'text'; value: string }).value;
}

export async function parseAstroFile(filePath: string): Promise<ParsedAstroFile> {
  const source = await readFile(filePath, 'utf-8');
  const { ast } = await parse(source, { position: true });

  const htmlNodes: HtmlElementInfo[] = [];
  const linkedCssHrefs: string[] = [];
  let cssContent = '';

  // Extract CSS imports from frontmatter (import "./styles.css")
  const frontmatterNode = ast.children.find((n: Node) => n.type === 'frontmatter');
  if (frontmatterNode) {
    const fm = (frontmatterNode as { type: 'frontmatter'; value: string }).value;
    const cssImportRegex = /import\s+['"]([^'"]+\.css)['"]\s*;?/g;
    let match: RegExpExecArray | null;
    while ((match = cssImportRegex.exec(fm)) !== null) {
      linkedCssHrefs.push(match[1]);
    }
  }

  walkRecursive(ast, (node, prevSibling, parentElement) => {
    if (is.element(node)) {
      // Extract style block content
      const styleText = extractStyleContent(node);
      if (styleText) {
        cssContent += styleText + '\n';
        return null;
      }

      // Detect <link rel="stylesheet" href="...">
      if (node.name === 'link') {
        const rel = node.attributes.find(a => a.name === 'rel');
        const href = node.attributes.find(a => a.name === 'href');
        if (rel?.value === 'stylesheet' && href?.value && href.kind === 'quoted') {
          linkedCssHrefs.push(href.value);
        }
      }

      // Skip non-visual elements
      if (IGNORED_TAGS.has(node.name)) return null;

      const ignored = isIgnoreComment(prevSibling) || hasIgnoreAttribute(node);

      const elementInfo: HtmlElementInfo = {
        tagName: node.name,
        classes: extractClasses(node),
        id: extractId(node),
        inlineStyles: extractInlineStyles(node),
        position: {
          line: node.position?.start.line ?? 0,
          column: node.position?.start.column ?? 0,
        },
        hasTextContent: hasTextContent(node),
        ignored,
        parentElement,
      };
      htmlNodes.push(elementInfo);
      return elementInfo;
    }
    return null;
  });

  const { rules, customProperties, imports: styleImports } = parseCssBlock(cssContent);

  return {
    filePath,
    htmlNodes,
    styleRules: rules,
    customProperties,
    linkedCssHrefs,
    styleImports,
  };
}

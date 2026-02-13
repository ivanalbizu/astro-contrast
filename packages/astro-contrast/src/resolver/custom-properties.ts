import valueParser from 'postcss-value-parser';

const MAX_DEPTH = 10;

export function resolveCustomProperty(
  value: string,
  properties: Map<string, string>,
  depth = 0,
): string | null {
  if (depth >= MAX_DEPTH) return null;
  if (!value.includes('var(')) return value;

  const parsed = valueParser(value);
  let hasUnresolved = false;

  // Replace var() nodes in-place, then stringify the full AST
  parsed.walk((node) => {
    if (node.type === 'function' && node.value === 'var') {
      const args = node.nodes.filter((n) => n.type !== 'div' && n.type !== 'space');
      const propName = args[0]?.value;
      const fallback = args.slice(1).map((n) => valueParser.stringify(n)).join('').trim();

      let resolvedValue: string | null = null;

      if (propName && properties.has(propName)) {
        resolvedValue = resolveCustomProperty(properties.get(propName)!, properties, depth + 1);
      } else if (fallback) {
        resolvedValue = resolveCustomProperty(fallback, properties, depth + 1);
      }

      if (resolvedValue !== null) {
        // Replace the var() function node with a simple word node
        (node as unknown as valueParser.WordNode).type = 'word';
        node.value = resolvedValue;
        (node as unknown as { nodes: undefined }).nodes = undefined;
      } else {
        hasUnresolved = true;
      }
      return false; // Don't walk into var() children
    }
  });

  if (hasUnresolved) return null;

  return valueParser.stringify(parsed.nodes);
}

export function resolveDeclarationValues(
  rules: Array<{ declarations: Array<{ value: string; resolvedValue: string | null }> }>,
  customProperties: Map<string, string>,
): void {
  for (const rule of rules) {
    for (const decl of rule.declarations) {
      if (decl.value.includes('var(')) {
        decl.resolvedValue = resolveCustomProperty(decl.value, customProperties);
      } else {
        decl.resolvedValue = decl.value;
      }
    }
  }
}

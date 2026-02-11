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
  let resolved = '';
  let hasUnresolved = false;

  parsed.walk((node) => {
    if (node.type === 'function' && node.value === 'var') {
      const args = node.nodes.filter((n) => n.type !== 'div' && n.type !== 'space');
      const propName = args[0]?.value;
      const fallback = args.slice(1).map((n) => valueParser.stringify(n)).join('').trim();

      if (propName && properties.has(propName)) {
        const propValue = properties.get(propName)!;
        const deepResolved = resolveCustomProperty(propValue, properties, depth + 1);
        if (deepResolved !== null) {
          resolved += deepResolved;
        } else {
          hasUnresolved = true;
        }
      } else if (fallback) {
        const deepResolved = resolveCustomProperty(fallback, properties, depth + 1);
        if (deepResolved !== null) {
          resolved += deepResolved;
        } else {
          hasUnresolved = true;
        }
      } else {
        hasUnresolved = true;
      }
      return false; // Don't walk into var() children
    }
  });

  if (hasUnresolved) return null;

  // If no var() was found in the walk, return original value
  if (resolved === '') return value;

  return resolved;
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

# astro-contrast

WCAG color contrast analyzer for Astro components.

This is a monorepo:

- [`packages/astro-contrast/`](packages/astro-contrast/) — The npm package (CLI, Astro integration, API)
- Root project — Astro demo site for testing the package

## Quick Start

```sh
npm install
npm run build:pkg
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Astro dev server (with contrast integration) |
| `npm run build` | Build the Astro demo site |
| `npm run contrast` | Analyze all demo `.astro` files |
| `npm run contrast:tokens` | Same, loading `tokens/colors.json` |
| `npm test` | Run package tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run build:pkg` | Build the package |
| `npm run typecheck` | TypeScript check |

## Development

```sh
# Build the package
npm run build:pkg

# Analyze the demo components
npm run contrast

# With design tokens
npm run contrast:tokens

# Run the Astro dev server (with integration)
npm run dev

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

See the full documentation in [`packages/astro-contrast/README.md`](packages/astro-contrast/README.md).

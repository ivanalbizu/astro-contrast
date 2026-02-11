# Contributing to astro-contrast

## Prerequisites

- Node.js 18+
- npm 7+ (workspaces support)

## Setup

```sh
git clone https://github.com/ivanalbizu/astro-contrast.git
cd astro-contrast
npm install
```

## Project Structure

```
astro-contrast/
├── src/                          # Astro demo site (for testing)
├── packages/
│   └── astro-contrast/           # The npm package
│       ├── src/
│       │   ├── parser/           # Astro & CSS parsing
│       │   ├── contrast/         # Color parsing, contrast calculation
│       │   ├── resolver/         # Custom properties, Tailwind, tokens
│       │   ├── reporter/         # Console output
│       │   ├── analyzer.ts       # Main analysis pipeline
│       │   ├── cli.ts            # CLI entry point
│       │   └── integration.ts    # Astro integration
│       ├── tests/
│       │   ├── fixtures/         # .astro test fixtures
│       │   └── contrast/         # Unit tests
│       └── bin/cli.mjs           # CLI bin entry
├── tokens/                       # Example design token files
└── package.json                  # Workspace root
```

## Development Scripts

Run from the **root** of the monorepo:

| Script | Description |
|---|---|
| `npm test` | Run all tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run build:pkg` | Build the package |
| `npm run typecheck` | TypeScript type check |
| `npm run contrast` | Run CLI against the demo site |
| `npm run pack` | Build + create `.tgz` for local testing |

## Running Tests

```sh
# All tests
npm test

# Watch mode
npm run test:watch

# Single test file
npx vitest run packages/astro-contrast/tests/contrast/color-utils.test.ts
```

## Testing Locally in Another Project

Use `npm pack` to create a real `.tgz` tarball and install it in another Astro project. This simulates a real `npm install` and verifies that `bin`, `exports`, `types`, and `files` are all correct.

```sh
# 1. Build and pack
npm run pack
# Creates packages/astro-contrast/astro-contrast-0.1.0.tgz

# 2. In another Astro project, install the tarball
npm install /path/to/astro-contrast/packages/astro-contrast/astro-contrast-0.1.0.tgz

# 3. Use as CLI
npx astro-contrast "src/**/*.astro" --verbose

# 4. Or as Astro integration (astro.config.mjs)
# import astroContrast from 'astro-contrast';
# integrations: [astroContrast({ level: 'aa', verbose: true })]
```

After making changes, re-run `npm run pack` and reinstall the `.tgz` in your test project.

## Adding a New Color Format

1. Add the parser function in `packages/astro-contrast/src/contrast/color-utils.ts`
2. Wire it into `parseColor()` at the bottom of the file
3. Add unit tests in `packages/astro-contrast/tests/contrast/color-utils.test.ts`
4. Run `npm test` to verify

## Adding a New Feature

1. Write tests first (fixtures in `tests/fixtures/`, unit tests in `tests/`)
2. Implement the feature
3. Run `npm test` and `npm run typecheck`
4. Update `README.md` if it affects user-facing behavior

## Code Style

- TypeScript, ESM (`"type": "module"`)
- No external dependencies for contrast calculation (custom WCAG 2.1 implementation)
- Prefer simple solutions over abstractions
- Tests use vitest

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

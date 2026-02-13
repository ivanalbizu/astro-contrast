# astro-contrast

WCAG color contrast analyzer for Astro components. Checks your `.astro` files for color contrast issues at build time, dev time, or on demand via CLI.

## Features

- Parses `.astro` files and extracts color pairs (text color + background)
- Calculates WCAG 2.1 contrast ratios
- Supports hex, rgb, hsl, oklch, oklab, lab, lch, and named CSS colors (including alpha channels)
- **`color-mix()` support** — resolves `color-mix()` across 7 color spaces
- **Large text detection** — applies lower WCAG thresholds for headings, large fonts, and bold text
- **Tailwind CSS support** — resolves `text-*` and `bg-*` utility classes
- Resolves CSS custom properties (`var(--color)`) from `:root`
- **Auto-detects external CSS** — `<link rel="stylesheet">` and `@import` are loaded automatically
- Reads external design tokens (Style Dictionary, Cobalt UI, Terrazzo)
- Ignore specific elements or rules with comments
- **GitHub Actions annotations** — contrast failures appear inline in PR diffs automatically
- **Dev dashboard** — visual contrast report in the browser during development
- Works as **CLI**, **Astro integration**, or **programmatic API**
- Watch mode for real-time analysis during development

## Install

```sh
npm install -D @ivanalbizu/astro-contrast
```

## Usage

### CLI

```sh
# Analyze all .astro files
astro-contrast "src/**/*.astro"

# With WCAG AAA level
astro-contrast "src/**/*.astro" --level aaa

# Show all pairs, not just failures
astro-contrast "src/**/*.astro" --verbose

# Watch mode
astro-contrast "src/**/*.astro" --watch

# With design tokens
astro-contrast "src/**/*.astro" --tokens tokens/colors.json
astro-contrast "src/**/*.astro" --tokens primitives.json --tokens semantic.json

# With external/global CSS
astro-contrast "src/**/*.astro" --css src/styles/global.css
astro-contrast "src/**/*.astro" --css variables.css --css theme.css

# JSON output
astro-contrast "src/**/*.astro" --json
```

#### CLI Options

| Option | Description |
|---|---|
| `--level aa\|aaa` | WCAG level to check (default: `aa`) |
| `--verbose`, `-v` | Show all pairs, not just failures |
| `--watch`, `-w` | Watch for file changes and re-analyze |
| `--tokens <file>` | Token file (JSON/YAML/CSS). Repeatable |
| `--css <file>` | External CSS file. Repeatable |
| `--ignore-color <val>` | Color to ignore globally. Repeatable |
| `--ignore-pair <val>` | Color pair to ignore (`fg:bg`). Repeatable |
| `--ignore-selector <sel>` | Selector to ignore (`.class`, `#id`, `tag`, `.prefix-*`). Repeatable |
| `--json` | Output results as JSON |
| `--help`, `-h` | Show help |
| `--version` | Show version |

#### Exit codes

| Code | Meaning |
|---|---|
| `0` | All pairs pass the required level |
| `1` | At least one pair fails |
| `2` | Error during analysis |

### Astro Integration

Add `@ivanalbizu/astro-contrast` to your `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import astroContrast from '@ivanalbizu/astro-contrast';

export default defineConfig({
  integrations: [
    astroContrast({
      level: 'aa',
      verbose: true,
      css: ['src/styles/global.css'],
    }),
  ],
});
```

This runs contrast analysis automatically during `astro dev` (with file watching) and `astro build`.

#### Integration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | `'aa' \| 'aaa'` | `'aa'` | WCAG level to check |
| `verbose` | `boolean` | `false` | Show all pairs, not just failures |
| `failOnError` | `boolean` | `false` | Fail the build if contrast issues are found |
| `tokens` | `string[]` | `[]` | Paths to token files |
| `css` | `string[]` | `[]` | Paths to external CSS files |
| `ignore` | `IgnoreConfig` | `undefined` | Global ignore rules (see below) |
| `dashboard` | `boolean \| string` | `false` | Dev dashboard URL. `true` = `/_contrast`, string = custom path |

### Dev Dashboard

Enable the dashboard to view contrast results in the browser during development:

```js
astroContrast({
  dashboard: true, // available at http://localhost:4321/_contrast
})
```

Or with a custom URL:

```js
astroContrast({
  dashboard: '/debug-astro-contrast',
})
```

The dashboard shows all analyzed files with their color pairs, contrast ratios, and pass/fail status. It auto-refreshes every 2 seconds when you edit `.astro` files — no need to reload the page.

A JSON API is also available at `{dashboardUrl}/api` for programmatic access.

### Programmatic API

```ts
import { analyzeFile, analyzeFiles } from '@ivanalbizu/astro-contrast';

const result = await analyzeFile('src/components/Button.astro');

console.log(result.stats);
// { elementsAnalyzed: 2, pairsChecked: 2, passing: 1, aaFailing: 1, ... }

for (const cr of result.results) {
  console.log(`${cr.element.tagName} — ${cr.ratio}:1 — ${cr.meetsAA ? 'PASS' : 'FAIL'}`);
}
```

With external tokens:

```ts
import { analyzeFiles } from '@ivanalbizu/astro-contrast';
import { readTokenFiles } from 'astro-contrast/dist/chunk-HPYGY3PW.js'; // internal

const tokens = await readTokenFiles(['tokens/colors.json']);
const results = await analyzeFiles(files, { externalTokens: tokens });
```

## Design Tokens

astro-contrast can read external design token files and resolve `var()` references against them. Supported formats:

### JSON — W3C DTCG / Style Dictionary

Compatible with [W3C Design Token Community Group](https://tr.designtokens.org/format/) format, used by Cobalt UI, Terrazzo, and Style Dictionary v4:

```json
{
  "color": {
    "$type": "color",
    "primary": {
      "$value": "#1a5276"
    },
    "danger": {
      "$value": "#e74c3c"
    },
    "info": {
      "$value": "{color.primary}"
    }
  }
}
```

Also supports Style Dictionary v3 format (`value`/`type` without `$` prefix).

### YAML

Same structure as JSON, with `.yaml` or `.yml` extension:

```yaml
color:
  $type: color
  primary:
    $value: "#1a5276"
  danger:
    $value: "#e74c3c"
  info:
    $value: "{color.primary}"
```

### CSS

Plain CSS files with `:root` declarations:

```css
:root {
  --color-primary: #1a5276;
  --color-danger: #e74c3c;
}
```

### How tokens are mapped

Token paths are converted to CSS custom properties:

| Token path | CSS variable |
|---|---|
| `color.primary` | `--color-primary` |
| `color.primitives.blue.500` | `--color-primitives-blue-500` |

Token references (`{color.primary}`) are resolved recursively before mapping.

When a `.astro` file defines the same custom property in its `<style>` block, the in-file value takes priority over the external token.

## External / Global CSS

### Auto-detection

astro-contrast automatically detects and loads external CSS referenced in your `.astro` files via:

- **`import "./styles.css"`** — in the frontmatter (component script)
- **`<link rel="stylesheet" href="./styles.css">`** — in the HTML template
- **`@import './tokens.css'`** — inside `<style>` blocks

This works recursively: if `a.css` imports `b.css` which imports `c.css`, all three are loaded. Circular imports are handled safely.

Only relative paths (`./`, `../`) are resolved. Absolute URLs (`http://`, `https://`) and package imports are skipped.

### Manual `--css` flag

For CSS files that aren't referenced directly in `.astro` files (e.g. injected by a build tool), use `--css` (CLI) or `css` (integration):

```sh
astro-contrast "src/**/*.astro" --css src/styles/global.css --css src/styles/variables.css
```

External CSS files provide:
- **CSS rules** — selectors and declarations (e.g. `.heading { color: #1a5276; }`)
- **Custom properties** — `:root` variables (e.g. `--color-primary: #1a5276`)

**Priority order**: external tokens < auto-detected CSS < manual `--css` < in-file `:root` / `<style>`. In-file styles always win at equal specificity.

## Tailwind CSS

astro-contrast detects Tailwind utility classes and resolves them to colors using the default Tailwind v3 palette. No configuration needed.

**Supported patterns:**

```astro
<!-- Standard palette colors -->
<button class="text-white bg-blue-700">Submit</button>

<!-- Arbitrary values -->
<p class="text-[#1a5276] bg-[#d4e6f1]">Custom colors</p>
```

| Pattern | Example | Resolves to |
|---|---|---|
| `text-{color}-{shade}` | `text-blue-500` | `color: #3b82f6` |
| `bg-{color}-{shade}` | `bg-red-600` | `background-color: #dc2626` |
| `text-white` / `text-black` | `text-white` | `color: #ffffff` |
| `text-[value]` | `text-[#1a5276]` | `color: #1a5276` |
| `bg-[value]` | `bg-[rgb(26,82,118)]` | `background-color: rgb(26,82,118)` |

**Priority order**: inline styles > Tailwind classes > CSS rules > defaults.

**Not yet supported**: responsive variants (`md:text-white`), state variants (`hover:bg-blue-500`), opacity modifiers (`text-blue-500/50`), custom Tailwind config.

## `color-mix()`

astro-contrast resolves CSS `color-mix()` functions and calculates the resulting color for contrast analysis. Works with `var()` references inside `color-mix()`.

```css
:root {
  --color-base: #ffffff;
  --color-main: #000000;
  --surface: color-mix(in srgb, var(--color-base) 98%, var(--color-main));
}
```

**Supported color spaces:**

| Color space | Interpolation method |
|---|---|
| `srgb` | Linear interpolation in gamma-encoded sRGB |
| `srgb-linear` | Linear interpolation in linear-light sRGB |
| `oklab` | Linear interpolation in OKLab (perceptually uniform) |
| `oklch` | Polar interpolation with shortest hue path |
| `lab` | Linear interpolation in CIE Lab |
| `lch` | Polar interpolation with shortest hue path |
| `hsl` | Polar interpolation with shortest hue path |

Percentage arguments follow the CSS spec: both explicit (`color-mix(in srgb, red 30%, blue 70%)`), single (`color-mix(in srgb, red 25%, blue)` — blue gets 75%), and omitted (`color-mix(in srgb, red, blue)` — 50/50).

## Ignoring Elements

You can skip specific elements or CSS rules from contrast analysis using ignore comments.

### HTML comment

Place `<!-- astro-contrast-ignore -->` before the element to skip:

```astro
<p class="decorative">This is checked</p>
<!-- astro-contrast-ignore -->
<p class="decorative">This is skipped</p>
```

### HTML attribute

Add `data-contrast-ignore` to the element:

```astro
<span class="badge" data-contrast-ignore>Decorative badge</span>
```

### CSS comment

Place `/* astro-contrast-ignore */` before a CSS rule to skip it:

```css
.alert {
  color: #fff;
  background-color: #e74c3c;
}
/* astro-contrast-ignore */
.decorative {
  color: #ccc;
  background-color: #ddd;
}
```

### Global Ignore Rules

For repetitive patterns like brand colors that intentionally fail contrast, use global ignore rules instead of per-element comments.

#### Astro Integration

```js
astroContrast({
  ignore: {
    colors: ['#e74c3c'],                                    // ignore this color everywhere
    pairs: [{ foreground: '#ffffff', background: '#e74c3c' }], // ignore this exact pair
    selectors: ['.brand-badge', '.alert-*'],                // ignore matching elements
  }
})
```

#### CLI

```sh
# Ignore a color globally (repeatable)
astro-contrast "src/**/*.astro" --ignore-color "#e74c3c"

# Ignore a specific foreground:background pair (repeatable)
astro-contrast "src/**/*.astro" --ignore-pair "#ffffff:#e74c3c"

# Ignore elements by selector, supports * wildcards (repeatable)
astro-contrast "src/**/*.astro" --ignore-selector ".brand-badge" --ignore-selector ".alert-*"
```

| Rule type | What it does |
|---|---|
| `colors` | Ignores any pair where the color appears as foreground **or** background |
| `pairs` | Ignores only when both foreground and background match exactly |
| `selectors` | Ignores elements matching `.class`, `#id`, `tag`, or wildcard patterns like `.prefix-*` |

Colors are compared by their resolved RGB value — `#e74c3c` and `rgb(231, 76, 60)` are treated as the same color.

## CI / GitHub Actions

When running in GitHub Actions, astro-contrast automatically emits annotations that appear inline in pull request diffs. No configuration needed — it detects the `GITHUB_ACTIONS` environment variable.

Contrast failures appear as error annotations on the exact line of the failing element.

**Example workflow:**

```yaml
- name: Check contrast
  run: astro-contrast "src/**/*.astro"
```

If the check fails (exit code 1), the PR will show annotations like:

> **Error** src/components/Card.astro#L7
> Contrast 2.8:1 fails AA (requires 4.5:1) — #999999 on #ffffff (.card-meta)

When using `--level aaa`, pairs that pass AA but fail AAA appear as warnings instead of errors.

## How It Works

1. **Parse** — Reads `.astro` files using `@astrojs/compiler` and extracts HTML elements, `<style>` blocks, `<link>` hrefs, and `@import` references
2. **Extract CSS** — Parses style blocks with PostCSS to get selectors, color declarations, and `:root` custom properties. Auto-loads CSS from `<link>` and `@import` recursively
3. **Resolve** — Resolves `var()` references using custom properties from `:root`, auto-detected CSS, external CSS files, and/or design tokens. Evaluates `color-mix()` functions
4. **Match** — Matches HTML elements to CSS rules by selector (type, class, ID, compound, descendant, child combinator) and resolves Tailwind utility classes
5. **Evaluate** — Calculates WCAG 2.1 contrast ratio for each foreground/background pair
6. **Report** — Outputs results with pass/fail status for AA and AAA levels

## WCAG 2.1 Contrast Requirements

| Level | Normal text | Large text |
|---|---|---|
| **AA** | 4.5:1 | 3:1 |
| **AAA** | 7:1 | 4.5:1 |

> **Large text** is defined as ≥ 18px, or ≥ 14px bold (font-weight ≥ 700). astro-contrast detects font size from inline styles, CSS rules, Tailwind classes (`text-xl`, `font-bold`, etc.), and HTML heading defaults (`<h1>`–`<h4>`).
>
> Viewport-dependent values (`vw`, `vh`) and CSS functions (`clamp()`, `min()`, `max()`, `calc()`) cannot be resolved statically. When the font size cannot be determined, astro-contrast defaults to **normal text** thresholds — the stricter requirement — to avoid false passes.

## Example Output

```
src/components/atoms/Button.astro
   PASS  .btn-primary  L5  #ffffff on #1a5276  →  8.4:1  (AA ✓  AAA ✓)
   PASS  .btn-danger   L6  #ffffff on #514f4f  →  8.1:1  (AA ✓  AAA ✓)

src/components/molecules/Card.astro
   PASS  .card-title  L6  #1a1a1a on #ffffff  →  17.4:1  (AA ✓  AAA ✓) [large]
   FAIL  .card-meta   L7  #999999 on #ffffff  →  2.8:1   (AA requires 4.5:1)
   PASS  .card-body   L8  #333333 on #ffffff  →  12.6:1  (AA ✓  AAA ✓)

Summary:
  Files analyzed: 2
  Color pairs checked: 5
  Passing: 4 | Failing: 1
```

## Development Scripts

| Script | Description |
|---|---|
| `npm run build` | Build with tsup |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run prepublishOnly` | Runs typecheck + test + build (auto on `npm publish`) |

## Alpha Compositing

When a color has an alpha channel (transparency), the visible color depends on what's behind it. astro-contrast composites both foreground and background colors using the standard alpha compositing formula:

```
composited = color × alpha + behind × (1 - alpha)
```

**Foreground alpha** — the text color is composited onto the background:

```astro
<p style="color: rgba(0, 0, 0, 0.5); background-color: #ffffff">Semi-transparent text</p>
<!-- Visible text color: rgb(128, 128, 128) → contrast ~3.95:1 instead of 21:1 -->
```

**Background alpha** — the background is composited onto the surface behind it (ancestor background → root background → white):

```astro
<p style="color: #000; background-color: rgba(255, 0, 0, 0.5)">Text on semi-transparent red</p>
<!-- Background composited on white: rgb(255, 128, 128) — light pink -->
```

**What's supported:**

| Case | Example |
|---|---|
| Foreground `rgba()`/`hsla()`/hex8 on opaque background | `rgba(0,0,0,0.5)` on `#fff` |
| Background `rgba()`/`hsla()`/hex8 composited on ancestor/root/white | `bg: rgba(255,0,0,0.5)` on implicit white |

**Not yet supported:**

| Case | Why |
|---|---|
| CSS `opacity` property | Applies to the entire element, not just the color — requires layout tree traversal |
| Nested opacity | Parent `opacity: 0.5` affects child elements — requires CSS inheritance chain |

## Current Limitations

- **Background inheritance (same file)** — Child elements inherit `background-color` from ancestor elements within the same `.astro` file (inline styles, Tailwind classes, and CSS rules). Cross-file inheritance (e.g. layout → page) requires `--css`
- **Pseudo-class colors included** — CSS rules with `:hover`, `:focus`, `:active` are analyzed against the base element (the pseudo-class is stripped). This means hover/focus colors are checked for contrast, but are not distinguished from base-state colors in the output
- **No media queries** — Selectors inside `@media` are not scope-aware. Attribute selectors (`[data-x]`) are stripped during matching
- **No sibling combinators** — Adjacent sibling (`+`) and general sibling (`~`) selectors are matched by the target part only (the context is ignored)
- **No dynamic font sizes** — `clamp()`, `min()`, `max()`, `calc()`, and viewport units (`vw`, `vh`) cannot be resolved; text is treated as normal size (stricter threshold)
- **SCSS/SASS nesting supported** — `<style lang="scss">` blocks are parsed: nested selectors (`.card { .title { } }` → `.card .title`), `&` parent references (`.btn { &:hover { } }` → `.btn:hover`), and plain CSS declarations are all extracted. SCSS-only features (`$variables`, `@mixin`, `@include`, `@extend`) are ignored — those values won't be resolved. If you need preprocessor variables, compile them to CSS custom properties and use `--css` or `--tokens`
- **No dark mode / theme scopes** — Only `:root` and `html` custom properties are extracted. Variables under `[data-theme="dark"]`, `.dark`, or `@media (prefers-color-scheme: dark)` are not resolved. Workaround: use separate CSS files per theme and run with `--css themes/light.css` or `--css themes/dark.css`

## License

MIT

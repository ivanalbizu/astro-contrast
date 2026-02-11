import { relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { analyzeFile, analyzeFiles } from './analyzer.js';
import type { AnalyzeOptions } from './analyzer.js';
import { reportResults } from './reporter/console-reporter.js';
import { emitGitHubAnnotations } from './reporter/github-reporter.js';
import { readTokenFiles } from './resolver/token-reader.js';
import { resolveLinkedCss } from './resolver/css-auto-resolver.js';
import type { CssRuleInfo, IgnoreConfig, IgnorePair } from './types/index.js';

interface CliOptions {
  patterns: string[];
  level: 'aa' | 'aaa';
  verbose: boolean;
  json: boolean;
  watch: boolean;
  tokens: string[];
  css: string[];
  ignoreColors: string[];
  ignorePairs: string[];
  ignoreSelectors: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const patterns: string[] = [];
  const tokens: string[] = [];
  const css: string[] = [];
  const ignoreColors: string[] = [];
  const ignorePairs: string[] = [];
  const ignoreSelectors: string[] = [];
  let level: 'aa' | 'aaa' = 'aa';
  let verbose = false;
  let json = false;
  let watch = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--level' && args[i + 1]) {
      const val = args[i + 1].toLowerCase();
      if (val === 'aa' || val === 'aaa') {
        level = val;
      }
      i++;
    } else if (arg === '--tokens' && args[i + 1]) {
      tokens.push(args[i + 1]);
      i++;
    } else if (arg === '--css' && args[i + 1]) {
      css.push(args[i + 1]);
      i++;
    } else if (arg === '--ignore-color' && args[i + 1]) {
      ignoreColors.push(args[i + 1]);
      i++;
    } else if (arg === '--ignore-pair' && args[i + 1]) {
      ignorePairs.push(args[i + 1]);
      i++;
    } else if (arg === '--ignore-selector' && args[i + 1]) {
      ignoreSelectors.push(args[i + 1]);
      i++;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--watch' || arg === '-w') {
      watch = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version') {
      console.log('astro-contrast v0.1.0');
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      patterns.push(arg);
    }
  }

  return { patterns, level, verbose, json, watch, tokens, css, ignoreColors, ignorePairs, ignoreSelectors };
}

function printHelp(): void {
  console.log(`
${pc.bold('astro-contrast')} - WCAG color contrast analyzer for Astro components

${pc.bold('Usage:')}
  astro-contrast <glob> [options]

${pc.bold('Examples:')}
  astro-contrast "src/**/*.astro"
  astro-contrast "src/**/*.astro" --tokens tokens.json
  astro-contrast "src/**/*.astro" --tokens primitives.json --tokens semantic.json
  astro-contrast "src/**/*.astro" --css src/styles/global.css --verbose
  astro-contrast "src/**/*.astro" --watch --verbose

${pc.bold('Options:')}
  --tokens <file>  Token file (JSON/YAML/CSS). Repeatable for multiple files
  --css <file>     External CSS file. Repeatable for multiple files
  --ignore-color <val>    Color to ignore globally. Repeatable
  --ignore-pair <val>     Color pair to ignore (fg:bg). Repeatable
  --ignore-selector <sel> Selector to ignore (.class, #id, tag, .prefix-*). Repeatable
  --watch, -w      Watch for file changes and re-analyze
  --level aa|aaa   WCAG level to check (default: aa)
  --verbose, -v    Show all pairs, not just failures
  --json           Output results as JSON
  --help, -h       Show this help message
  --version        Show version

${pc.bold('Token formats:')}
  JSON  W3C DTCG (Cobalt, Terrazzo), Style Dictionary v3/v4
  YAML  Same structure as JSON (.yaml, .yml)
  CSS   Files with :root { --var: value; } declarations

${pc.bold('Exit codes:')}
  0  All pairs pass the required level
  1  At least one pair fails
  2  Error during analysis
`);
}

function timestamp(): string {
  return pc.dim(new Date().toLocaleTimeString());
}

async function loadTokens(tokenPaths: string[]): Promise<Map<string, string>> {
  if (tokenPaths.length === 0) return new Map();

  const tokens = await readTokenFiles(tokenPaths);
  if (tokens.size > 0) {
    console.log(pc.dim(`Loaded ${tokens.size} color tokens from ${tokenPaths.length} file${tokenPaths.length > 1 ? 's' : ''}`));
  }
  return tokens;
}

function parsePairFlag(value: string): IgnorePair {
  const sep = value.indexOf(':');
  if (sep === -1) {
    console.error(pc.yellow(`Warning: Invalid --ignore-pair format "${value}". Expected "foreground:background" (e.g. "#fff:#e74c3c").`));
    return { foreground: '', background: '' };
  }
  return { foreground: value.slice(0, sep).trim(), background: value.slice(sep + 1).trim() };
}

async function loadExternalCss(cssPaths: string[]): Promise<{ rules: CssRuleInfo[]; customProperties: Map<string, string> }> {
  const { rules, customProperties } = await resolveLinkedCss(cssPaths, process.cwd());

  if (rules.length > 0 || customProperties.size > 0) {
    console.log(pc.dim(`Loaded ${rules.length} CSS rules and ${customProperties.size} custom properties from ${cssPaths.length} file${cssPaths.length > 1 ? 's' : ''}`));
  }
  return { rules, customProperties };
}

async function runAnalysis(
  filePaths: string[],
  options: CliOptions,
  analyzeOptions: AnalyzeOptions,
): Promise<boolean> {
  const results = await analyzeFiles(filePaths, analyzeOptions);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    reportResults(results, { verbose: options.verbose, level: options.level });
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    emitGitHubAnnotations(results, { level: options.level });
  }

  return results.some(r =>
    r.results.some(cr =>
      options.level === 'aaa' ? !cr.meetsAAA : !cr.meetsAA,
    ),
  );
}

async function runWatch(
  patterns: string[],
  options: CliOptions,
  analyzeOptions: AnalyzeOptions,
): Promise<void> {
  const { watch: chokidarWatch } = await import('chokidar');

  // Initial full analysis
  const filePaths = await fg(patterns, { absolute: true, onlyFiles: true });

  if (filePaths.length === 0) {
    console.log(pc.yellow('No .astro files found matching the given pattern(s).'));
    return;
  }

  console.log(pc.dim(`Analyzing ${filePaths.length} file${filePaths.length > 1 ? 's' : ''}...\n`));
  await runAnalysis(filePaths, options, analyzeOptions);

  // Start watching
  console.log(pc.cyan(pc.bold(`Watching for changes...`)), pc.dim('(Ctrl+C to stop)\n'));

  const watcher = chokidarWatch(filePaths, {
    ignoreInitial: true,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const handleChange = (filePath: string, event: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      const rel = relative(process.cwd(), filePath);

      if (event === 'unlink') {
        console.log(`${timestamp()} ${pc.yellow('removed')} ${rel}\n`);
        return;
      }

      console.log(`${timestamp()} ${pc.cyan('changed')} ${rel}`);

      try {
        const result = await analyzeFile(filePath, analyzeOptions);
        reportResults([result], { verbose: options.verbose, level: options.level });
      } catch (err) {
        console.error(pc.red(`  Error analyzing ${rel}: ${err instanceof Error ? err.message : String(err)}`));
      }

      console.log(pc.dim('Watching for changes...'), '\n');
    }, 100);
  };

  watcher.on('change', (path) => handleChange(path, 'change'));
  watcher.on('unlink', (path) => handleChange(path, 'unlink'));

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(`\n${pc.dim('Stopped watching.')}`);
    watcher.close();
    process.exit(0);
  });
}

export async function run(): Promise<void> {
  const options = parseArgs(process.argv);

  if (options.patterns.length === 0) {
    console.error(pc.red('Error: No files specified.'));
    console.error('Usage: astro-contrast <glob> [options]');
    console.error('Example: astro-contrast "src/**/*.astro"');
    process.exit(2);
  }

  console.log(`\n${pc.bold('astro-contrast')} v0.1.0\n`);

  // Load external data
  const externalTokens = await loadTokens(options.tokens);
  const externalCss = await loadExternalCss(options.css);

  // Build ignore config from CLI flags
  const hasIgnore = options.ignoreColors.length > 0 || options.ignorePairs.length > 0 || options.ignoreSelectors.length > 0;
  const ignore: IgnoreConfig | undefined = hasIgnore
    ? {
        colors: options.ignoreColors.length > 0 ? options.ignoreColors : undefined,
        pairs: options.ignorePairs.length > 0 ? options.ignorePairs.map(parsePairFlag) : undefined,
        selectors: options.ignoreSelectors.length > 0 ? options.ignoreSelectors : undefined,
      }
    : undefined;

  const analyzeOptions: AnalyzeOptions = {
    externalTokens: externalTokens.size > 0 ? externalTokens : undefined,
    externalCssRules: externalCss.rules.length > 0 ? externalCss.rules : undefined,
    externalCustomProperties: externalCss.customProperties.size > 0 ? externalCss.customProperties : undefined,
    ignore,
  };

  if (options.watch) {
    await runWatch(options.patterns, options, analyzeOptions);
    return;
  }

  // Single-run mode
  let filePaths: string[];
  try {
    filePaths = await fg(options.patterns, {
      absolute: true,
      onlyFiles: true,
    });
  } catch (err) {
    console.error(pc.red(`Error resolving patterns: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(2);
    return;
  }

  if (filePaths.length === 0) {
    console.error(pc.yellow('No .astro files found matching the given pattern(s).'));
    process.exit(0);
    return;
  }

  console.log(pc.dim(`Analyzing ${filePaths.length} file${filePaths.length > 1 ? 's' : ''}...\n`));

  try {
    const hasFailures = await runAnalysis(filePaths, options, analyzeOptions);
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error(pc.red(`Error during analysis: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(2);
  }
}

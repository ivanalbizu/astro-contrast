import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import type { AstroIntegration } from 'astro';
import { analyzeFile, analyzeFiles } from './analyzer.js';
import type { AnalyzeOptions } from './analyzer.js';
import { reportResults } from './reporter/console-reporter.js';
import { emitGitHubAnnotations } from './reporter/github-reporter.js';
import { generateDashboardHtml } from './reporter/html-reporter.js';
import { readTokenFiles } from './resolver/token-reader.js';
import { resolveLinkedCss } from './resolver/css-auto-resolver.js';
import type { FileAnalysisResult, IgnoreConfig } from './types/index.js';

export interface AstroContrastOptions {
  /** WCAG level to check: 'aa' (default) or 'aaa' */
  level?: 'aa' | 'aaa';
  /** Show all pairs, not just failures */
  verbose?: boolean;
  /** Fail the build if contrast issues are found (default: false) */
  failOnError?: boolean;
  /** Paths to token files (JSON DTCG/Style Dictionary or CSS) */
  tokens?: string[];
  /** Paths to external CSS files */
  css?: string[];
  /** Global ignore rules for colors, pairs, and selectors */
  ignore?: IgnoreConfig;
  /** Dev dashboard URL. true = '/_contrast', string = custom path, false = disabled (default) */
  dashboard?: boolean | string;
}

const DEFAULT_DASHBOARD_URL = '/_contrast';

export default function astroContrast(options: AstroContrastOptions = {}): AstroIntegration {
  const { level = 'aa', verbose = false, failOnError = false, tokens: tokenPaths = [], css: cssPaths = [], ignore, dashboard = false } = options;
  let srcDir: string;
  let analyzeOpts: AnalyzeOptions;
  let latestResults: FileAnalysisResult[] = [];

  const dashboardUrl = dashboard === true
    ? DEFAULT_DASHBOARD_URL
    : typeof dashboard === 'string'
      ? dashboard
      : null;

  return {
    name: 'astro-contrast',
    hooks: {
      'astro:config:done': async ({ config, logger }) => {
        srcDir = fileURLToPath(config.srcDir);

        // Load external tokens
        const externalTokens = await readTokenFiles(tokenPaths);
        if (externalTokens.size > 0) {
          logger.info(`Loaded ${externalTokens.size} color tokens from ${tokenPaths.length} file(s)`);
        }

        // Load external CSS (follows @import recursively)
        const externalCss = await resolveLinkedCss(cssPaths, process.cwd());
        const externalCssRules = externalCss.rules;
        const externalCustomProperties = externalCss.customProperties;

        if (externalCssRules.length > 0 || externalCustomProperties.size > 0) {
          logger.info(`Loaded ${externalCssRules.length} CSS rules and ${externalCustomProperties.size} custom properties from ${cssPaths.length} file(s)`);
        }

        analyzeOpts = {
          externalTokens: externalTokens.size > 0 ? externalTokens : undefined,
          externalCssRules: externalCssRules.length > 0 ? externalCssRules : undefined,
          externalCustomProperties: externalCustomProperties.size > 0 ? externalCustomProperties : undefined,
          ignore,
        };

        logger.info(`Contrast checking enabled (WCAG ${level.toUpperCase()})`);
      },

      'astro:server:setup': async ({ server, logger }) => {
        const { watch } = await import('chokidar');

        // Initial analysis
        const pattern = `${srcDir}**/*.astro`;
        const files = await fg(pattern, { absolute: true, onlyFiles: true });

        if (files.length > 0) {
          logger.info(`Analyzing ${files.length} files...`);
          const results = await analyzeFiles(files, analyzeOpts);
          latestResults = results;
          reportResults(results, { verbose, level });
        }

        // Dashboard middleware
        if (dashboardUrl) {
          server.middlewares.use((req, res, next) => {
            if (req.url === dashboardUrl) {
              const html = generateDashboardHtml(latestResults, { level, apiUrl: dashboardUrl });
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }
            if (req.url === `${dashboardUrl}/api`) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(latestResults, (_key, value) =>
                value instanceof Map ? Object.fromEntries(value) : value,
              ));
              return;
            }
            next();
          });
          logger.info(`Dashboard available at ${dashboardUrl}`);
        }

        // Watch srcDir for changes AND new .astro files (chokidar 4 needs paths, not globs)
        const watcher = watch(srcDir, { ignoreInitial: true });
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const handleFile = (filePath: string) => {
          if (!filePath.endsWith('.astro')) return;
          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(async () => {
            const rel = relative(process.cwd(), filePath);
            logger.info(`Analyzing ${rel}`);

            try {
              const result = await analyzeFile(filePath, analyzeOpts);
              reportResults([result], { verbose, level });

              // Update dashboard store — replace or add file results
              const idx = latestResults.findIndex(r => r.filePath === result.filePath);
              if (idx >= 0) {
                latestResults[idx] = result;
              } else {
                latestResults.push(result);
              }
            } catch (err) {
              logger.error(`Error analyzing ${rel}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }, 100);
        };

        watcher.on('change', handleFile);
        watcher.on('add', handleFile);
      },

      'astro:build:done': async ({ logger }) => {
        const pattern = `${srcDir}**/*.astro`;
        const files = await fg(pattern, { absolute: true, onlyFiles: true });

        if (files.length === 0) {
          logger.info('No .astro files found to analyze.');
          return;
        }

        logger.info(`Analyzing ${files.length} files...`);
        const results = await analyzeFiles(files, analyzeOpts);
        reportResults(results, { verbose, level });

        if (process.env.GITHUB_ACTIONS === 'true') {
          emitGitHubAnnotations(results, { level });
        }

        const hasFailures = results.some(r =>
          r.results.some(cr =>
            level === 'aaa' ? !cr.meetsAAA : !cr.meetsAA,
          ),
        );

        if (hasFailures && failOnError) {
          throw new Error(
            `astro-contrast: Contrast check failed. Fix the issues above or set failOnError: false.`,
          );
        }

        if (hasFailures) {
          logger.warn('Contrast issues found. Set failOnError: true to fail the build.');
        } else {
          logger.info(`All contrast checks pass ${level.toUpperCase()}!`);
        }
      },
    },
  };
}

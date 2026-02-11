import { relative } from 'node:path';
import type { FileAnalysisResult, ContrastResult } from '../types/index.js';

interface DashboardOptions {
  level?: 'aa' | 'aaa';
  apiUrl: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rgbToCss(color: ContrastResult['foreground']): string {
  if (!color.rgb) return 'transparent';
  const { r, g, b } = color.rgb;
  return `rgb(${r},${g},${b})`;
}

function renderResult(result: ContrastResult, level: 'aa' | 'aaa'): string {
  const isFailing = level === 'aaa' ? !result.meetsAAA : !result.meetsAA;
  const statusClass = result.meetsAAA ? 'pass' : result.meetsAA ? 'aa-only' : 'fail';
  const statusLabel = result.meetsAAA ? 'PASS' : result.meetsAA ? 'AA' : 'FAIL';

  const aaReq = result.isLargeText ? '3:1' : '4.5:1';
  const aaaReq = result.isLargeText ? '4.5:1' : '7:1';
  let wcag = '';
  if (result.meetsAAA) {
    wcag = 'AA &#10003;  AAA &#10003;';
  } else if (result.meetsAA) {
    wcag = `AA &#10003;  AAA &#10007; (requires ${aaaReq})`;
  } else {
    wcag = `AA requires ${aaReq}`;
  }

  const largeTag = result.isLargeText ? '<span class="tag large">large</span>' : '';
  const fgCss = rgbToCss(result.foreground);
  const bgCss = rgbToCss(result.background);

  return `<div class="result ${statusClass}" data-failing="${isFailing}">
  <div class="result-header">
    <span class="status ${statusClass}">${statusLabel}</span>
    <span class="selector">${escapeHtml(result.foreground.selector)}</span>
    <span class="line">L${result.element.position.line}</span>
    ${largeTag}
  </div>
  <div class="result-colors">
    <span class="color-swatch" style="background:${fgCss}"></span>
    <span class="color-value">${escapeHtml(result.foreground.original)}</span>
    <span class="on">on</span>
    <span class="color-swatch" style="background:${bgCss}"></span>
    <span class="color-value">${escapeHtml(result.background.original)}</span>
    <span class="arrow">&rarr;</span>
    <span class="ratio">${result.ratio.toFixed(1)}:1</span>
  </div>
  <div class="result-wcag">${wcag}</div>
</div>`;
}

function renderFile(file: FileAnalysisResult, level: 'aa' | 'aaa'): string {
  const relPath = relative(process.cwd(), file.filePath);
  const failing = file.results.filter(r => level === 'aaa' ? !r.meetsAAA : !r.meetsAA).length;
  const fileClass = failing > 0 ? 'has-failures' : 'all-pass';

  const results = file.results.map(r => renderResult(r, level)).join('\n');
  const errors = file.errors.map(e =>
    `<div class="result warn"><div class="result-header"><span class="status warn">WARN</span> ${escapeHtml(e.message)}</div></div>`
  ).join('\n');

  return `<div class="file ${fileClass}">
  <h2 class="file-path">${escapeHtml(relPath)}${failing > 0 ? ` <span class="file-count">${failing} failing</span>` : ''}</h2>
  ${results}
  ${errors}
  ${file.results.length === 0 && file.errors.length === 0 ? '<p class="no-pairs">No color pairs to analyze</p>' : ''}
</div>`;
}

export function generateDashboardHtml(
  results: FileAnalysisResult[],
  options: DashboardOptions,
): string {
  const { level = 'aa', apiUrl } = options;

  const totalPairs = results.reduce((sum, f) => sum + f.stats.pairsChecked, 0);
  const totalFailing = results.reduce((sum, f) =>
    sum + f.results.filter(r => level === 'aaa' ? !r.meetsAAA : !r.meetsAA).length, 0);
  const totalPassing = totalPairs - totalFailing;

  const filesHtml = results.map(f => renderFile(f, level)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>astro-contrast dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0e0e10; color: #e4e4e7;
    line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto;
  }
  header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #27272a;
  }
  h1 { font-size: 1.25rem; font-weight: 600; }
  .summary {
    color: #a1a1aa; font-size: 0.875rem;
    display: flex; gap: 1rem; align-items: center;
  }
  .summary .failing { color: #ef4444; font-weight: 600; }
  .summary .passing { color: #22c55e; }
  .controls { display: flex; gap: 0.75rem; align-items: center; }
  .controls label { font-size: 0.8rem; color: #a1a1aa; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; }
  .controls input[type="checkbox"] { accent-color: #8b5cf6; }
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
    display: inline-block; animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .file { margin-bottom: 1.5rem; }
  .file-path {
    font-size: 0.9rem; font-weight: 600; color: #67e8f9;
    margin-bottom: 0.5rem; padding: 0.25rem 0;
  }
  .file-count { font-size: 0.75rem; color: #ef4444; font-weight: 400; }

  .result {
    background: #18181b; border: 1px solid #27272a; border-radius: 8px;
    padding: 0.75rem 1rem; margin-bottom: 0.5rem;
  }
  .result.fail { border-left: 3px solid #ef4444; }
  .result.aa-only { border-left: 3px solid #eab308; }
  .result.pass { border-left: 3px solid #22c55e; }
  .result.warn { border-left: 3px solid #eab308; }

  .result-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
  .status {
    font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem;
    border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .status.fail { background: #7f1d1d; color: #fca5a5; }
  .status.aa-only { background: #713f12; color: #fde047; }
  .status.pass { background: #14532d; color: #86efac; }
  .status.warn { background: #713f12; color: #fde047; }
  .selector { color: #a1a1aa; font-size: 0.8rem; }
  .line { color: #71717a; font-size: 0.75rem; }
  .tag { font-size: 0.65rem; padding: 0.1rem 0.3rem; border-radius: 3px; }
  .tag.large { background: #1e1b4b; color: #a5b4fc; }

  .result-colors {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.85rem; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  }
  .color-swatch {
    width: 16px; height: 16px; border-radius: 3px;
    border: 1px solid #3f3f46; display: inline-block; flex-shrink: 0;
  }
  .color-value { color: #d4d4d8; }
  .on { color: #52525b; font-size: 0.75rem; }
  .arrow { color: #52525b; }
  .ratio { font-weight: 600; }
  .result.fail .ratio { color: #ef4444; }
  .result.aa-only .ratio { color: #eab308; }
  .result.pass .ratio { color: #22c55e; }

  .result-wcag { font-size: 0.75rem; color: #71717a; margin-top: 0.2rem; }
  .no-pairs { color: #52525b; font-size: 0.85rem; font-style: italic; }

  .all-pass-banner {
    text-align: center; padding: 2rem; color: #22c55e;
    font-size: 1.1rem; font-weight: 500;
  }

  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <div>
    <h1>astro-contrast</h1>
    <div class="summary">
      <span>${results.length} file${results.length !== 1 ? 's' : ''}</span>
      <span>${totalPairs} pair${totalPairs !== 1 ? 's' : ''}</span>
      ${totalFailing > 0
        ? `<span class="failing">${totalFailing} failing</span>`
        : `<span class="passing">all passing</span>`}
    </div>
  </div>
  <div class="controls">
    <label><input type="checkbox" id="filter-failing" checked> Show only failures</label>
    <label><span class="status-dot"></span> Auto-refresh</label>
  </div>
</header>

<main id="dashboard">
${totalPairs === 0
    ? '<p class="no-pairs">No color pairs found. Add color styles to your .astro files.</p>'
    : totalFailing === 0
      ? `<div class="all-pass-banner">All ${totalPassing} pairs pass ${level.toUpperCase()}!</div>\n${filesHtml}`
      : filesHtml}
</main>

<script>
(function() {
  const API = '${apiUrl}';
  const filterCheckbox = document.getElementById('filter-failing');

  function applyFilter() {
    const onlyFailing = filterCheckbox.checked;
    document.querySelectorAll('.result').forEach(el => {
      if (onlyFailing && el.dataset.failing === 'false') {
        el.classList.add('hidden');
      } else {
        el.classList.remove('hidden');
      }
    });
    document.querySelectorAll('.file').forEach(file => {
      const visible = file.querySelectorAll('.result:not(.hidden)');
      if (onlyFailing && visible.length === 0) {
        file.classList.add('hidden');
      } else {
        file.classList.remove('hidden');
      }
    });
  }

  filterCheckbox.addEventListener('change', applyFilter);
  applyFilter();

  async function refresh() {
    try {
      const res = await fetch(API);
      if (!res.ok) return;
      const html = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newMain = doc.getElementById('dashboard');
      const newSummary = doc.querySelector('.summary');
      if (newMain) document.getElementById('dashboard').innerHTML = newMain.innerHTML;
      if (newSummary) document.querySelector('.summary').innerHTML = newSummary.innerHTML;

      applyFilter();
    } catch {}
  }

  setInterval(refresh, 2000);
})();
</script>
</body>
</html>`;
}

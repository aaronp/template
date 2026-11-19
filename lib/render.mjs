import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRecord } from './manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = 'https://github.com/aaronp/template';

function originRepo(cwd) {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1] ?? '';
  } catch {
    return '';
  }
}

function packageName(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ?? '';
  } catch {
    return '';
  }
}

// `pages` is accepted for symmetry with build/dev; card URLs are already baked in by snapshot.
export function projectData({ cwd, pages, name }) {
  const areas = readRecord(cwd).tools;
  const cards = {};
  for (const e of areas) {
    const p = path.posix.join(path.posix.dirname(e.file), 'card.json');
    try { cards[p] = JSON.parse(fs.readFileSync(path.join(cwd, p), 'utf8')); } catch {}
  }
  return {
    project: { name: name || packageName(cwd) || path.basename(cwd), repo: originRepo(cwd), template: TEMPLATE },
    areas,
    cards
  };
}

// Inlined scripts must not contain `</script` or `<!--` (support.js has a `<!--` with no `-->`, which puts the
// HTML tokenizer in an escaped state that swallows the closing tag). In these files both occur only inside strings
// and non-/u regexes, where `\!` and `\/` mean `!` and `/`.
const safeJs = (js) => js.replaceAll('<!--', '<\\!--').replaceAll('</script', '<\\/script');

const tag = (src) => new RegExp(`<script src="\\./${src.replaceAll('.', '\\.')}"></script>\\n?`);

export function renderDashboard(data, { inline }) {
  let html = fs.readFileSync(path.join(root, 'dashboard', 'dashboard.dc.html'), 'utf8');
  // Same rule for the embedded JSON.
  const json = JSON.stringify(data).replaceAll('</', '<\\/').replaceAll('<!--', '\\u003c!--');
  const swap = (src, to) => {
    if (!tag(src).test(html)) throw new Error(`bug: dashboard has no <script src="./${src}"> anchor`);
    html = html.replace(tag(src), () => to);
  };
  if (inline) {
    for (const f of ['vendor/react.js', 'vendor/react-dom.js', 'support.js'])
      swap(f, `<script>\n${safeJs(fs.readFileSync(path.join(root, f), 'utf8'))}\n</script>\n`);
    swap('docs/cards.js', `<script>window.PROJECT = ${json};</script>\n`);
    swap('local.js', ''); // Pages has no local.js
  } else {
    for (const f of ['vendor/react.js', 'vendor/react-dom.js', 'support.js', 'local.js']) swap(f, `<script src="/${f}"></script>\n`);
    swap('docs/cards.js', '<script src="/project.js"></script>\n');
  }
  return html;
}

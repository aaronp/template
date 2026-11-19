import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { findTool, readRecord, writeRecord } from './manifest.mjs';
import { snapshot } from './snapshot.mjs';

const SELF = '@pritzlaff/project';

export function detectPM(cwd) {
  const has = (f) => fs.existsSync(path.join(cwd, f));
  if (has('bun.lock') || has('bun.lockb')) return 'bun';
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  return 'npm';
}

export function pmArgs(pm, action, pkgs) {
  if (action === 'add') return pm === 'npm' ? ['i', '-D', ...pkgs] : ['add', pm === 'bun' ? '-d' : '-D', ...pkgs];
  if (action === 'remove') return [pm === 'npm' ? 'uninstall' : 'remove', ...pkgs];
  if (pm === 'npm') return ['i', '-D', ...pkgs.map((p) => `${p}@latest`)];
  // ponytail: classic yarn only; berry needs `yarn up`, which a lockfile alone can't tell us
  return [pm === 'yarn' ? 'upgrade' : 'update', '--latest', ...pkgs];
}

function pm(cwd, action, pkgs) {
  const bin = detectPM(cwd);
  execFileSync(bin, pmArgs(bin, action, pkgs), { cwd, stdio: 'inherit' });
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const cardDir = (cwd, entry) => path.join(cwd, path.dirname(entry.file));

async function fetchScript(manifest, script) {
  const src = new URL(script, manifest.base.includes('://') ? manifest.base : 'file://' + manifest.base.replace(/\/*$/, '/'));
  if (src.protocol === 'file:') return fs.readFileSync(src);
  const r = await fetch(src);
  if (!r.ok) throw new Error(`Could not fetch ${src}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function wire(cwd, manifest, entry) {
  const record = readRecord(cwd);
  record.tools = [...record.tools.filter((t) => t.id !== entry.id), entry];
  writeRecord(cwd, record);
  if (entry.card?.script) {
    const dest = path.join(cwd, 'docs', 'cards', `${entry.id}.mjs`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, await fetchScript(manifest, entry.card.script));
  }
  const file = path.join(cwd, entry.file);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, entry.starter ?? '');
  }
}

export function unwire(cwd, id) {
  const record = readRecord(cwd);
  const entry = record.tools.find((t) => t.id === id);
  if (!entry) return;
  writeRecord(cwd, { ...record, tools: record.tools.filter((t) => t.id !== id) });
  for (const f of [path.join(cwd, 'docs', 'cards', `${id}.mjs`), path.join(cardDir(cwd, entry), 'card.json'), path.join(cardDir(cwd, entry), 'badge.svg')])
    fs.rmSync(f, { force: true });
  console.log(`kept ${entry.file}`);
}

const strip = ({ order, ...rest }) => rest;

export function list(cwd, manifest) {
  const rec = readRecord(cwd).tools;
  return manifest.tools
    .map((t) => {
      const r = rec.find((x) => x.id === t.id);
      let version = '-';
      try { version = readJson(path.join(cwd, 'node_modules', t.package, 'package.json')).version; } catch {}
      const marker = !r ? ' ' : isDeepStrictEqual(strip(r), strip(t)) ? '*' : '~';
      return `${marker} ${t.id.padEnd(14)} ${t.name.padEnd(14)} ${t.package.padEnd(28)} ${version}`;
    })
    .join('\n');
}

function isSelf(cwd) {
  try { return readJson(path.join(cwd, 'package.json')).name === SELF; } catch { return false; }
}

function hasSelfDep(cwd) {
  try {
    const p = readJson(path.join(cwd, 'package.json'));
    return !!(p.dependencies?.[SELF] || p.devDependencies?.[SELF]);
  } catch { return false; }
}

// New files are empty and a tool may refuse them: wiring has already succeeded, so warn instead of failing.
async function softSnapshot(cwd, pages) {
  try { await snapshot({ cwd, pages }); } catch (e) { console.warn(`snapshot: ${e.message.trim()}`); }
}

export async function add(cwd, manifest, names, { install = true, pages } = {}) {
  const tools = names.map((n) => findTool(manifest, n));
  if (install) {
    const pkgs = tools.map((t) => t.package);
    if (!isSelf(cwd) && !hasSelfDep(cwd)) pkgs.push(SELF);
    pm(cwd, 'add', pkgs);
  }
  for (const t of tools) await wire(cwd, manifest, t);
  writeRecord(cwd, { ...readRecord(cwd), manifestVersion: manifest.version });
  await softSnapshot(cwd, pages);
  console.log('Next: npx project dev | npx project build | npx project pages');
}

export function remove(cwd, names, { install = true } = {}) {
  const rec = readRecord(cwd).tools;
  const entries = names.map((n) => rec.find((t) => t.id === n || (t.aliases || []).includes(n)) || findTool({ tools: rec }, n));
  for (const e of entries) unwire(cwd, e.id);
  if (install) pm(cwd, 'remove', entries.map((e) => e.package));
}

export async function update(cwd, manifest, names, { install = true, pages } = {}) {
  const rec = readRecord(cwd).tools;
  const tools = (names?.length ? names.map((n) => findTool(manifest, n)) : rec.map((r) => findTool(manifest, r.id)));
  for (const t of tools) {
    const old = strip(rec.find((r) => r.id === t.id) || {});
    const next = strip(t);
    const diff = {};
    for (const k of new Set([...Object.keys(old), ...Object.keys(next)]))
      if (!isDeepStrictEqual(old[k], next[k])) diff[k] = { from: old[k], to: next[k] };
    console.log(`${t.id}: ${Object.keys(diff).length ? JSON.stringify(diff) : 'unchanged'}`);
    await wire(cwd, manifest, t);
  }
  writeRecord(cwd, { ...readRecord(cwd), manifestVersion: manifest.version });
  if (install) pm(cwd, 'update', tools.map((t) => t.package));
  await softSnapshot(cwd, pages);
}

const INSTALL = { bun: 'bun install', pnpm: 'pnpm install', yarn: 'yarn install', npm: 'npm ci || npm install' };

const workflow = (pmName) => `# Publishes the repo (dashboard, docs/ and generated summaries) to GitHub Pages.
# One-time setup: Settings -> Pages -> Source: "GitHub Actions".
name: Pages
on:
  push:
    branches: [main, master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
${pmName === 'bun' ? '      - uses: oven-sh/setup-bun@v2\n' : ''}      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: ${INSTALL[pmName]}
      - run: npx project build --out _site --pages https://\${{ github.repository_owner }}.github.io/\${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
`;

export function pages(cwd) {
  const file = path.join(cwd, '.github', 'workflows', 'pages.yml');
  if (fs.existsSync(file)) {
    console.log(`${path.relative(cwd, file)} exists; its build step should be:\n  npx project build --out _site --pages https://\${{ github.repository_owner }}.github.io/\${{ github.event.repository.name }}/`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, workflow(detectPM(cwd)));
  console.log(`wrote ${path.relative(cwd, file)}`);
}

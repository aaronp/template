import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readRecord } from './manifest.mjs';

const slash = (u) => u.replace(/\/*$/, '/');

// GitHub Pages root for the repo: owner lowercased; an `owner.github.io` repo is served at the root.
export function pagesUrl(cwd, override) {
  if (override) return slash(override);
  let remote;
  try {
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) return '';
  const owner = m[1].toLowerCase();
  return m[2].toLowerCase() === `${owner}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${m[2]}/`;
}

export function resolveBin(cwd, entry) {
  const local = path.join(cwd, 'node_modules', '.bin', entry.bin);
  if (fs.existsSync(local)) return local;
  try {
    const pkgPath = createRequire(import.meta.url).resolve(`${entry.package}/package.json`);
    const bin = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin;
    return path.join(path.dirname(pkgPath), typeof bin === 'string' ? bin : bin[entry.bin]);
  } catch {
    throw new Error(`${entry.package} is not installed: run your package manager's install`);
  }
}

const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

function run(cwd, script, args, env) {
  try {
    execFileSync(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`${path.basename(script)} ${args.join(' ')} failed: ${e.stderr || e.message}`);
  }
}

function basicCard(cwd, entry, pages) {
  let changed = '';
  try {
    changed = execFileSync('git', ['log', '-1', '--format=%cs', '--', entry.file], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}
  return {
    version: 1,
    title: entry.name,
    subtitle: entry.tool,
    status: { label: 'Not summarised', tone: 'neutral' },
    heading: { primary: changed || 'new', label: 'last changed' },
    legend: [],
    report: {},
    source: { label: entry.file, url: entry.viewer + '?src=' + (pages + entry.file) }
  };
}

export async function snapshot({ cwd, pages = '', force = false }) {
  pages = pages ? slash(pages) : '';
  const written = [];
  for (const entry of readRecord(cwd).tools) {
    const file = path.join(cwd, entry.file);
    if (!fs.existsSync(file)) {
      console.warn(`skipping ${entry.id}: ${entry.file} not found (project add ${entry.id})`);
      continue;
    }
    const dir = path.dirname(file);
    const cardPath = path.join(dir, 'card.json');
    const script = path.join(cwd, 'docs', 'cards', `${entry.id}.mjs`);
    const sidecar = path.join(dir, path.basename(file, path.extname(file)) + '.card.json');
    const newest = Math.max(mtime(file), mtime(sidecar), mtime(script));
    if (!force && mtime(cardPath) && mtime(cardPath) >= newest) continue;

    const src = pages + entry.file;
    if (entry.card === false) {
      fs.writeFileSync(cardPath, JSON.stringify(basicCard(cwd, entry, pages), null, 2) + '\n');
    } else if (entry.card?.script) {
      run(cwd, script, [entry.file], { SRC: src });
    } else {
      const bin = resolveBin(cwd, entry);
      const env = pages && entry.srcEnv ? { [entry.srcEnv]: src } : {};
      run(cwd, bin, ['card', entry.file], env);
      run(cwd, bin, ['badge', entry.file], env);
    }
    written.push(cardPath);
  }
  return written;
}

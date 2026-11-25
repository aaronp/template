import fs from 'node:fs';
import path from 'node:path';
import { readRecord } from './manifest.mjs';

const START = '# >>> @pritzlaff/project — managed by `project add/remove/update`; edits inside are overwritten';
const END = '# <<< @pritzlaff/project';

export function renderBlock(entries, skip = new Set()) {
  const rows = [
    ['usage', 'npx project usage'], ['dashboard', 'npx project dev'], ['dashboard-build', 'npx project build'], ['snapshot', 'npx project snapshot'],
    ...entries.map((e) => [e.aliases?.[0] ?? e.id, `npx ${e.bin} ${e.file}`])
  ].filter(([n]) => !skip.has(n));
  return [START, `.PHONY: ${rows.map(([n]) => n).join(' ')}`, ...rows.map(([n, r]) => `${n}: ; ${r}`), END].join('\n') + '\n';
}

export function syncMakefile(cwd) {
  const file = path.join(cwd, 'Makefile');
  const existed = fs.existsSync(file);
  const old = existed ? fs.readFileSync(file, 'utf8') : '';
  const count = (m) => old.split(m).length - 1;
  const s = old.indexOf(START);
  const e = old.indexOf(END);
  const has = count(START) === 1 && count(END) === 1 && s < e;
  if (!has && (count(START) || count(END))) {
    console.warn('Makefile has unmatched or repeated @pritzlaff/project markers; leaving it unchanged — fix the markers and rerun');
    return { created: false, skipped: [], unchanged: true };
  }
  const before = has ? old.slice(0, s) : old;
  const after = has ? old.slice(e + END.length).replace(/^\r?\n/, '') : '';
  const skip = new Set();
  for (const line of (before + after).split('\n')) {
    const m = /^([A-Za-z0-9_.-]+)\s*:(?!=)/.exec(line);
    if (m && m[1] !== '.PHONY') skip.add(m[1]);
  }
  const entries = readRecord(cwd).tools;
  const wanted = [...renderBlock(entries).matchAll(/^([A-Za-z0-9_.-]+): ;/gm)].map((m) => m[1]);
  const skipped = wanted.filter((t) => skip.has(t));
  for (const t of skipped) console.warn(`Makefile already defines ${t}; leaving it out of the managed block`);
  const block = renderBlock(entries, skip);
  const sep = !has && old && !old.endsWith('\n\n') ? (old.endsWith('\n') ? '\n' : '\n\n') : '';
  fs.writeFileSync(file, has ? before + block + after : old + sep + block);
  return { created: !existed, skipped };
}

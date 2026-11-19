import fs from 'node:fs';
import path from 'node:path';

const isUrl = (s) => /^https?:\/\//.test(s);

export async function loadManifest(src) {
  const text = isUrl(src)
    ? await fetch(src).then((r) => {
        if (!r.ok) throw new Error(`Could not fetch ${src}: ${r.status}`);
        return r.text();
      })
    : fs.readFileSync(src, 'utf8');
  const m = JSON.parse(text);
  if (m.version !== 1) throw new Error(`Unsupported manifest version ${m.version} (expected 1)`);
  const base = isUrl(src) ? new URL('.', src).href : path.dirname(path.resolve(src));
  return { version: m.version, tools: m.tools.map((t, order) => ({ ...t, order })), base };
}

export function findTool(manifest, name) {
  const t = manifest.tools.find((t) => t.id === name || (t.aliases || []).includes(name));
  if (!t) throw new Error(`Unknown tool "${name}". Try: project list`);
  return t;
}

const recordPath = (cwd) => path.join(cwd, 'docs', 'project.json');

export function readRecord(cwd) {
  try {
    return JSON.parse(fs.readFileSync(recordPath(cwd), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return { manifestVersion: 0, tools: [] };
    throw e;
  }
}

export function writeRecord(cwd, record) {
  const tools = [...record.tools].sort((a, b) => a.order - b.order);
  fs.mkdirSync(path.dirname(recordPath(cwd)), { recursive: true });
  fs.writeFileSync(recordPath(cwd), JSON.stringify({ ...record, tools }, null, 2) + '\n');
}

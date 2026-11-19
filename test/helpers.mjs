import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRecord } from '../lib/manifest.mjs';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A temp project with the Acme docs, the overview card script and all seven tools recorded.
export function acmeProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
  fs.cpSync(path.join(repo, 'examples/acme/docs'), path.join(cwd, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs/cards'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'cards/celldeck.mjs'), path.join(cwd, 'docs/cards/overview.mjs'));
  const m = JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'), 'utf8'));
  writeRecord(cwd, { manifestVersion: m.version, tools: m.tools.map((t, order) => ({ ...t, order })) });
  return cwd;
}

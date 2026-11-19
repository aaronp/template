import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './helpers.mjs';
import { detectPM, wire, unwire, list, pages } from '../lib/install.mjs';
import { loadManifest, findTool, readRecord, writeRecord } from '../lib/manifest.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'inst-'));
const manifest = () => loadManifest(path.join(repo, 'manifest.json'));

test('detectPM picks by lockfile', () => {
  for (const [f, pm] of [['bun.lock', 'bun'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], [null, 'npm']]) {
    const cwd = tmp();
    if (f) fs.writeFileSync(path.join(cwd, f), '');
    assert.equal(detectPM(cwd), pm);
  }
});

test('wire is idempotent and never overwrites', async () => {
  const cwd = tmp(), m = await manifest();
  fs.mkdirSync(path.join(cwd, 'docs/adr'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'docs/adr/decisions.md'), 'mine');
  await wire(cwd, m, findTool(m, 'decisions'));
  await wire(cwd, m, findTool(m, 'decisions'));
  assert.equal(readRecord(cwd).tools.filter((t) => t.id === 'decisions').length, 1);
  assert.equal(fs.readFileSync(path.join(cwd, 'docs/adr/decisions.md'), 'utf8'), 'mine');
});

test('wire copies the card script', async () => {
  const cwd = tmp(), m = await manifest();
  await wire(cwd, m, findTool(m, 'overview'));
  assert.equal(fs.readFileSync(path.join(cwd, 'docs/cards/overview.mjs'), 'utf8'), fs.readFileSync(path.join(repo, 'cards/celldeck.mjs'), 'utf8'));
});

test('unwire keeps data', async () => {
  const cwd = tmp(), m = await manifest();
  await wire(cwd, m, findTool(m, 'decisions'));
  fs.writeFileSync(path.join(cwd, 'docs/adr/card.json'), '{}');
  unwire(cwd, 'decisions');
  assert.equal(readRecord(cwd).tools.length, 0);
  assert.ok(!fs.existsSync(path.join(cwd, 'docs/adr/card.json')));
  assert.ok(fs.existsSync(path.join(cwd, 'docs/adr/decisions.md')));
});

test('list marks installed and drifted', async () => {
  const cwd = tmp(), m = await manifest();
  await wire(cwd, m, findTool(m, 'decisions'));
  const r = readRecord(cwd);
  r.tools[0].dashboard.question = 'edited';
  writeRecord(cwd, r);
  const lines = list(cwd, m).split('\n');
  assert.equal(lines.length, 7);
  assert.ok(lines.find((l) => l.includes('decisions')).startsWith('~'));
  assert.ok(lines.find((l) => l.includes('goals')).startsWith(' '));
});

test('pages does not overwrite', () => {
  const cwd = tmp(), f = path.join(cwd, '.github/workflows/pages.yml');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'mine');
  pages(cwd);
  assert.equal(fs.readFileSync(f, 'utf8'), 'mine');
});

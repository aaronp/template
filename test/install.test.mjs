import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './helpers.mjs';
import { detectPM, wire, unwire, list, pages, add, remove, update, pmArgs } from '../lib/install.mjs';
import { snapshot } from '../lib/snapshot.mjs';
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

test('every starter is accepted by its tool', async () => {
  const cwd = tmp(), m = await manifest();
  const warn = [], orig = console.warn, log = console.log;
  console.warn = (...a) => warn.push(a.join(' '));
  console.log = () => {};
  try {
    await add(cwd, m, m.tools.map((t) => t.id), { install: false });
    const out = await snapshot({ cwd, force: true });
    assert.equal(out.length, 7);
  } finally { console.warn = orig; console.log = log; }
  assert.deepEqual(warn, []);
});

test('pmArgs per manager', () => {
  const p = ['a', 'b'];
  assert.deepEqual(pmArgs('bun', 'add', p), ['add', '-d', 'a', 'b']);
  assert.deepEqual(pmArgs('pnpm', 'add', p), ['add', '-D', 'a', 'b']);
  assert.deepEqual(pmArgs('yarn', 'add', p), ['add', '-D', 'a', 'b']);
  assert.deepEqual(pmArgs('npm', 'add', p), ['i', '-D', 'a', 'b']);
  for (const pm of ['bun', 'pnpm', 'yarn']) assert.deepEqual(pmArgs(pm, 'remove', p), ['remove', 'a', 'b']);
  assert.deepEqual(pmArgs('npm', 'remove', p), ['uninstall', 'a', 'b']);
  for (const pm of ['bun', 'pnpm']) assert.deepEqual(pmArgs(pm, 'update', p), ['update', '--latest', 'a', 'b']);
  assert.deepEqual(pmArgs('yarn', 'update', p), ['upgrade', '--latest', 'a', 'b']);
  assert.deepEqual(pmArgs('npm', 'update', p), ['i', '-D', 'a@latest', 'b@latest']);
});

test('pnpm workflow sets up pnpm and derives the Pages URL', () => {
  const cwd = tmp(), log = console.log;
  fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
  console.log = () => {};
  try { pages(cwd); } finally { console.log = log; }
  const y = fs.readFileSync(path.join(cwd, '.github/workflows/pages.yml'), 'utf8');
  assert.match(y, /- uses: pnpm\/action-setup@v4\n {8}with:\n {10}version: 10\n {6}- uses: actions\/setup-node@v4/);
  assert.match(y, /- run: pnpm install\n {6}- run: npx project build --out _site\n/);
});

const quiet = async (fn) => {
  const warn = [], w = console.warn, l = console.log;
  console.warn = (...a) => warn.push(a.join(' '));
  console.log = () => {};
  try { await fn(); } finally { console.warn = w; console.log = l; }
  return warn;
};

test('update all refreshes every recorded tool', async () => {
  const cwd = tmp(), m = await manifest();
  await quiet(() => add(cwd, m, ['decisions', 'risks'], { install: false }));
  const r = readRecord(cwd);
  r.tools[0].dashboard.question = 'edited';
  writeRecord(cwd, r);
  await quiet(() => update(cwd, m, ['all'], { install: false }));
  assert.deepEqual(readRecord(cwd).tools.map((t) => t.id), ['decisions', 'risks']);
  assert.notEqual(readRecord(cwd).tools[0].dashboard.question, 'edited');
});

test('remove all unwires every recorded tool', async () => {
  const cwd = tmp(), m = await manifest();
  await quiet(() => add(cwd, m, ['decisions', 'risks'], { install: false }));
  await quiet(() => remove(cwd, ['all'], { install: false }));
  assert.deepEqual(readRecord(cwd).tools, []);
});

test('update skips recorded tools the manifest dropped', async () => {
  const cwd = tmp(), m = await manifest();
  await quiet(() => add(cwd, m, ['decisions'], { install: false }));
  writeRecord(cwd, { ...readRecord(cwd), tools: [...readRecord(cwd).tools, { id: 'gone', order: 99 }] });
  const warn = await quiet(() => update(cwd, m, [], { install: false }));
  assert.ok(warn.includes('gone is no longer in the manifest; run: project remove gone'));
  await assert.rejects(update(cwd, m, ['gone'], { install: false }), /Unknown tool "gone"/);
});

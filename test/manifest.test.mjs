import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadManifest, findTool, readRecord, writeRecord } from '../lib/manifest.mjs';

const load = () => loadManifest('./manifest.json');

test('manifest has the seven areas in walkthrough order', async () => {
  const m = await load();
  assert.deepEqual(m.tools.map((t) => t.id), ['goals', 'architecture', 'overview', 'decisions', 'risks', 'schedule', 'work']);
});

test("aliases match today's make targets", async () => {
  const m = await load();
  for (const [name, id] of [['adr', 'decisions'], ['risks', 'risks'], ['c4', 'architecture'], ['celldeck', 'overview'],
    ['gantt', 'schedule'], ['agile', 'work'], ['goals', 'goals']]) {
    assert.equal(findTool(m, name).id, id);
  }
  assert.throws(() => findTool(m, 'nope'), /Unknown tool "nope"/);
});

test('overview uses the card script', async () => {
  const m = await load();
  assert.deepEqual(findTool(m, 'celldeck').card, { script: 'cards/celldeck.mjs' });
  for (const t of m.tools) if (t.id !== 'overview') assert.ok(!('card' in t), t.id);
});

test('loadManifest rejects an unknown version', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mf-')), 'm.json');
  fs.writeFileSync(f, JSON.stringify({ version: 2, tools: [] }));
  await assert.rejects(loadManifest(f), /version/);
});

test('record round-trips and keeps manifest order', async () => {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  assert.deepEqual(readRecord(dir), { manifestVersion: 0, tools: [] });
  writeRecord(dir, { manifestVersion: m.version, tools: [findTool(m, 'schedule'), findTool(m, 'goals')] });
  assert.deepEqual(readRecord(dir).tools.map((t) => t.id), ['goals', 'schedule']);
  assert.ok(fs.readFileSync(path.join(dir, 'docs/project.json'), 'utf8').endsWith('}\n'));
});

test('goals carries a non-empty starter', async () => {
  assert.ok(findTool(await load(), 'goals').starter.length > 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './helpers.mjs';
import { syncMakefile } from '../lib/makefile.mjs';
import { add } from '../lib/install.mjs';
import { loadManifest, findTool, readRecord, writeRecord } from '../lib/manifest.mjs';

const START = '# >>> @pritzlaff/project — managed by `project add/remove/update`; edits inside are overwritten';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mk-'));
const manifest = () => loadManifest(path.join(repo, 'manifest.json'));
async function project(...ids) {
  const cwd = tmp(), m = await manifest();
  writeRecord(cwd, { manifestVersion: m.version, tools: ids.map((id, order) => ({ ...findTool(m, id), order })) });
  return cwd;
}
const mk = (cwd) => path.join(cwd, 'Makefile');
const read = (cwd) => fs.readFileSync(mk(cwd), 'utf8');

test('creates a Makefile', async () => {
  const cwd = await project('decisions', 'risks');
  assert.equal(syncMakefile(cwd).created, true);
  const s = read(cwd);
  assert.ok(s.startsWith(START));
  assert.ok(s.includes('adr: ; npx adr docs/adr/decisions.md'));
  assert.ok(s.includes('risks: ; npx risk-register docs/risks/risks.md'));
});

test('appends and keeps the host content', async () => {
  const cwd = await project('decisions');
  fs.writeFileSync(mk(cwd), 'build:\n\tgo build\n');
  syncMakefile(cwd);
  const s = read(cwd);
  assert.ok(s.startsWith('build:\n\tgo build\n'));
  assert.ok(s.includes(START));
});

test('idempotent', async () => {
  const cwd = await project('decisions');
  syncMakefile(cwd);
  const a = read(cwd);
  syncMakefile(cwd);
  assert.equal(read(cwd), a);
});

test('replaces in place', async () => {
  const cwd = await project('decisions');
  syncMakefile(cwd);
  fs.appendFileSync(mk(cwd), 'after:\n\techo hi\n');
  const m = await manifest();
  writeRecord(cwd, { ...readRecord(cwd), tools: [...readRecord(cwd).tools, { ...findTool(m, 'risks'), order: 1 }] });
  syncMakefile(cwd);
  const s = read(cwd);
  assert.equal(s.split(START).length, 2);
  assert.ok(s.includes('risks:'));
  assert.ok(s.endsWith('after:\n\techo hi\n'));
});

test('skips host-defined targets', async () => {
  const cwd = await project('decisions');
  fs.writeFileSync(mk(cwd), 'dev:\n\tmy-dev\n');
  const warn = console.warn; console.warn = () => {};
  let r;
  try { r = syncMakefile(cwd); } finally { console.warn = warn; }
  assert.deepEqual(r.skipped, ['dev']);
  const block = read(cwd).slice(read(cwd).indexOf(START));
  assert.ok(!/^dev:/m.test(block));
  assert.ok(!/^\.PHONY:.*\bdev\b/m.test(block));
});

test('add honours --no-makefile', async () => {
  const m = await manifest();
  const a = tmp();
  await add(a, m, ['adr'], { install: false, makefile: false });
  assert.ok(!fs.existsSync(mk(a)));
  const b = tmp();
  await add(b, m, ['adr'], { install: false });
  assert.ok(fs.existsSync(mk(b)));
});

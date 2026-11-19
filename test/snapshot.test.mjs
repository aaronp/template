import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { acmeProject } from './helpers.mjs';
import { snapshot, pagesUrl } from '../lib/snapshot.mjs';
import { readRecord, writeRecord } from '../lib/manifest.mjs';

const card = (cwd, d) => JSON.parse(fs.readFileSync(path.join(cwd, 'docs', d, 'card.json'), 'utf8'));
const only = (cwd, ids) => {
  const r = readRecord(cwd);
  writeRecord(cwd, { ...r, tools: r.tools.filter((t) => ids.includes(t.id)) });
};
const PAGES = 'https://x.github.io/y';

test('writes a card for every area', async () => {
  const cwd = acmeProject();
  const out = await snapshot({ cwd, pages: PAGES, force: true });
  assert.equal(out.length, 7);
  const adr = card(cwd, 'adr');
  assert.equal(adr.version, 1);
  assert.match(adr.source.url, /src=(https%3A%2F%2Fx\.github\.io%2Fy%2Fdocs%2Fadr%2Fdecisions\.md|https:\/\/x\.github\.io\/y\/docs\/adr\/decisions\.md)/);
  assert.equal(card(cwd, 'overview').subtitle, 'Cell Deck');
});

test('pagesUrl adds one trailing slash', async () => {
  const cwd = acmeProject();
  assert.equal(pagesUrl(cwd, PAGES), PAGES + '/');
  assert.equal(pagesUrl(cwd, PAGES + '/'), PAGES + '/');
});

test('unrecorded files are ignored', async () => {
  const cwd = acmeProject();
  only(cwd, ['decisions']);
  fs.mkdirSync(path.join(cwd, 'docs/risks'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'docs/risks/risks.md'), '# stray\n');
  const out = await snapshot({ cwd, pages: PAGES, force: true });
  assert.equal(out.length, 1);
  assert.equal(fs.existsSync(path.join(cwd, 'docs/risks/card.json')), false);
});

test('missing file is skipped', async () => {
  const cwd = acmeProject();
  only(cwd, ['decisions']);
  fs.rmSync(path.join(cwd, 'docs/adr/decisions.md'));
  assert.deepEqual(await snapshot({ cwd, pages: PAGES, force: true }), []);
});

test('card false writes a basic card', async () => {
  const cwd = acmeProject();
  const r = readRecord(cwd);
  writeRecord(cwd, { ...r, tools: r.tools.map((t) => (t.id === 'decisions' ? { ...t, card: false } : t)) });
  await snapshot({ cwd, pages: PAGES, force: true });
  const c = card(cwd, 'adr');
  assert.equal(c.status.label, 'Not summarised');
  assert.equal(c.heading.label, 'last changed');
});

test('not stale, not rebuilt', async () => {
  const cwd = acmeProject();
  await snapshot({ cwd, pages: PAGES, force: true });
  assert.deepEqual(await snapshot({ cwd, pages: PAGES, force: false }), []);
});

test('ignores node_modules/.bin shims', async () => {
  const cwd = acmeProject();
  only(cwd, ['decisions']);
  const bin = readRecord(cwd).tools[0].bin;
  fs.mkdirSync(path.join(cwd, 'node_modules/.bin'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules/.bin', bin), '#!/bin/sh\nexec node "$@"\n');
  assert.equal((await snapshot({ cwd, pages: PAGES, force: true })).length, 1);
});

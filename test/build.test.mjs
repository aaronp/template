import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { acmeProject } from './helpers.mjs';
import { build } from '../lib/build.mjs';
import { projectData } from '../lib/render.mjs';
import { readRecord, writeRecord } from '../lib/manifest.mjs';

const PAGES = 'https://x.github.io/y/';
const embedded = (html) => JSON.parse(html.match(/window\.PROJECT = (.*?);<\/script>/s)[1]);

test('builds a self-contained dashboard', async () => {
  const cwd = acmeProject();
  const out = path.join(cwd, 'site');
  await build({ cwd, out, pages: PAGES });
  const html = fs.readFileSync(path.join(out, 'dashboard.html'), 'utf8');
  assert.match(html, /window\.PROJECT =/);
  assert.doesNotMatch(html, /src="\.\/vendor/);
  const data = embedded(html);
  assert.equal(data.areas.length, 7);
  assert.equal(Object.keys(data.cards).length, 7);
  // Each inline script closes where intended and still parses.
  for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotMatch(body, /<!--/);
    assert.doesNotMatch(body, /<x-dc/); // the runtime takes the first <x-dc in the page as its component
    new vm.Script(body);
  }
  assert.ok(fs.existsSync(path.join(out, 'docs/adr/decisions.md')));
  assert.ok(fs.existsSync(path.join(out, 'docs/overview/deck.json')));
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /dashboard\.html/);
});

test('keeps an existing index.html', async () => {
  const cwd = acmeProject();
  const out = path.join(cwd, 'site');
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'index.html'), 'mine');
  await build({ cwd, out, pages: PAGES });
  assert.equal(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), 'mine');
});

test('basic card renders', async () => {
  const cwd = acmeProject();
  const r = readRecord(cwd);
  writeRecord(cwd, { ...r, tools: r.tools.map((t) => (t.id === 'decisions' ? { ...t, card: false } : t)) });
  const out = path.join(cwd, 'site');
  await build({ cwd, out, pages: PAGES });
  const data = embedded(fs.readFileSync(path.join(out, 'dashboard.html'), 'utf8'));
  assert.equal(data.cards['docs/adr/card.json'].status.label, 'Not summarised');
});

test('project name: --name, then displayName, then name', () => {
  const cwd = acmeProject();
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'my-proj', displayName: 'My Project' }));
  assert.equal(projectData({ cwd }).project.name, 'My Project');
  assert.equal(projectData({ cwd, name: 'Acme' }).project.name, 'Acme');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'my-proj' }));
  assert.equal(projectData({ cwd }).project.name, 'my-proj');
});

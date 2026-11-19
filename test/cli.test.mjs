import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo } from './helpers.mjs';

// No network or package manager: each of these must fail before loading the manifest.
const run = (...args) =>
  spawnSync(process.execPath, [path.join(repo, 'bin/project.mjs'), ...args], { cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'cli-')), encoding: 'utf8' });

test('usage errors exit 1 with a message, not a stack', () => {
  for (const [args, msg] of [[['toString'], 'unknown command toString'], [['list', '--bogus'], "Unknown option '--bogus'"], [['add'], 'add needs a tool name'], [['remove'], 'remove needs a tool name']]) {
    const r = run(...args);
    assert.equal(r.status, 1, args.join(' '));
    assert.ok(r.stderr.startsWith(`project: ${msg}`), r.stderr);
    assert.match(r.stderr, /Usage: project/);
  }
});

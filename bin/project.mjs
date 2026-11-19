#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadManifest } from '../lib/manifest.mjs';
import { pagesUrl, snapshot } from '../lib/snapshot.mjs';
import { build } from '../lib/build.mjs';
import { list, add, remove, update, pages } from '../lib/install.mjs';

const USAGE = `Usage: project <command> [args] [flags]

Commands:
  list                 show every tool and whether it is installed
  add <tool...|all>    install tools and wire them into docs/
  remove <tool...|all> unwire tools and uninstall their packages
  update [tool...|all] refresh recorded entries and upgrade packages
  snapshot             write cards and badges
  build                write a self-contained site to --out
  dev                  serve the dashboard locally
  pages                write the GitHub Pages workflow
  help                 show this message

Flags:
  --manifest <url|path>  manifest to read (default https://aaronp.github.io/template/manifest.json)
  --pages <url>          public Pages URL (default: from git remote)
  --out <dir>            build output directory (default _site)
  --name <text>          project name for the dashboard
  --port <n>             dev server port (default 8000)
  --force                rewrite cards even if up to date
  --no-install           skip the package manager call (add/update/remove)
`;

const fail = (msg) => {
  console.error(`project: ${msg}\n\n${USAGE}`);
  process.exit(1);
};

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      manifest: { type: 'string', default: 'https://aaronp.github.io/template/manifest.json' },
      pages: { type: 'string' }, out: { type: 'string', default: '_site' }, name: { type: 'string' },
      port: { type: 'string', default: '8000' }, force: { type: 'boolean', default: false },
      'no-install': { type: 'boolean', default: false }
    }
  });
} catch (e) { fail(e.message); }
const { values: v, positionals: [cmd, ...args] } = parsed;

const cwd = process.cwd();
const install = !v['no-install'];
const pg = () => pagesUrl(cwd, v.pages);
const manifest = () => loadManifest(v.manifest);

const commands = {
  list: async () => console.log(list(cwd, await manifest())),
  add: async () => add(cwd, await manifest(), args, { install, pages: pg() }),
  remove: async () => remove(cwd, args, { install }),
  update: async () => update(cwd, await manifest(), args, { install, pages: pg() }),
  snapshot: async () => console.log((await snapshot({ cwd, pages: pg(), force: v.force })).length + ' cards written'),
  build: async () => build({ cwd, out: v.out, pages: pg(), name: v.name }),
  dev: async () => (await import('../lib/dev.mjs')).dev({ cwd, port: Number(v.port), pages: pg() }),
  pages: async () => pages(cwd)
};

if (!cmd || cmd === 'help') {
  console.log(USAGE);
} else if (!Object.hasOwn(commands, cmd)) {
  fail(`unknown command ${cmd}`);
} else if ((cmd === 'add' || cmd === 'remove') && !args.length) {
  fail(`${cmd} needs a tool name (or all)`);
} else {
  commands[cmd]().catch((e) => {
    console.error(`project: ${e.message}`);
    process.exit(1);
  });
}

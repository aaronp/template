#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadManifest } from '../lib/manifest.mjs';
import { pagesUrl, snapshot } from '../lib/snapshot.mjs';
import { build } from '../lib/build.mjs';
import { list, add, remove, update, pages, outdated } from '../lib/install.mjs';

const USAGE = `Usage: project <command> [args] [flags]

Commands:
  list                 show every tool, whether it is installed and if npm has a newer version
  add <tool...|all>    install tools and wire them into docs/
  remove <tool...|all> unwire tools and uninstall their packages
  update [tool...|all] refresh recorded entries and upgrade packages
  snapshot             write cards and badges
  dashboard            serve the dashboard locally and open it (alias: dev)
  dashboard-build      write the site (cards, badges, dashboard.html) to --out (alias: build)
  pages                write the GitHub Pages workflow
  help                 show this message

list and dashboard check npm for newer tool versions (NO_UPDATE_CHECK=1 or CI skips it).

Flags:
  --manifest <url|path>  manifest to read (default https://aaronp.github.io/template/manifest.json)
  --pages <url>          public Pages URL (default: from git remote)
  --out <dir>            build output directory (default _site)
  --app <dir>            built app to publish at the site root; the dashboard then goes under project/
  --name <text>          project name for the dashboard
  --port <n>             dev server port (default 8000)
  --force                rewrite cards even if up to date
  --no-install           skip the package manager call (add/update/remove)
  --no-makefile          leave the Makefile alone (add/update/remove)
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
      pages: { type: 'string' }, app: { type: 'string' }, out: { type: 'string', default: '_site' }, name: { type: 'string' },
      port: { type: 'string', default: '8000' }, force: { type: 'boolean', default: false },
      'no-install': { type: 'boolean', default: false }, 'no-makefile': { type: 'boolean', default: false }
    }
  });
} catch (e) { fail(e.message); }
const { values: v, positionals: [cmd, ...args] } = parsed;

const cwd = process.cwd();
const install = !v['no-install'];
const makefile = !v['no-makefile'];
const pg = () => pagesUrl(cwd, v.pages);
const manifest = () => loadManifest(v.manifest);

const commands = {
  list: async () => {
    console.log(list(cwd, await manifest()));
    const o = await outdated(cwd);
    if (o) console.log('\nNewer versions on npm:\n' + o);
  },
  add: async () => add(cwd, await manifest(), args, { install, makefile, pages: pg() }),
  remove: async () => remove(cwd, args, { install, makefile }),
  update: async () => update(cwd, await manifest(), args, { install, makefile, pages: pg() }),
  snapshot: async () => console.log((await snapshot({ cwd, pages: pg(), force: v.force })).length + ' cards written'),
  build: async () => build({ cwd, out: v.out, pages: pg(), name: v.name, app: v.app }),
  dev: async () => {
    outdated(cwd).then((o) => o && console.log('\nNewer versions on npm:\n' + o + '\n'));
    await (await import('../lib/dev.mjs')).dev({ cwd, port: Number(v.port), pages: pg() });
  },
  pages: async () => pages(cwd)
};
commands.dashboard = commands.dev;
commands['dashboard-build'] = commands.build;

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

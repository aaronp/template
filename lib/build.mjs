import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshot } from './snapshot.mjs';
import { readRecord } from './manifest.mjs';
import { projectData, renderDashboard } from './render.mjs';

// `app`: a built app directory (e.g. dist) published at the site root; the project site then goes under project/.
export async function build({ cwd, out = '_site', pages, name, app }) {
  out = path.resolve(cwd, out);
  if (app) {
    fs.cpSync(path.resolve(cwd, app), out, { recursive: true });
    out = path.join(out, 'project');
    if (pages) pages = pages.replace(/\/?$/, '/project/');
  }
  await snapshot({ cwd, pages, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'dashboard.html'), renderDashboard(projectData({ cwd, pages, name }), { inline: true }));
  for (const e of readRecord(cwd).tools) {
    const dir = path.dirname(e.file);
    for (const f of [e.file, path.join(dir, 'card.json'), path.join(dir, 'badge.svg')]) {
      if (!fs.existsSync(path.join(cwd, f))) continue;
      fs.mkdirSync(path.join(out, path.dirname(f)), { recursive: true });
      fs.copyFileSync(path.join(cwd, f), path.join(out, f));
    }
  }
  // API docs at api/, not docs/ (that holds the areas' files, and TypeDoc empties its output directory).
  // ponytail: only a typedoc.json triggers it; options in package.json/tsconfig alone are not detected.
  const api = fs.existsSync(path.join(cwd, 'typedoc.json'));
  if (api) execFileSync('npx', ['--no-install', 'typedoc', '--out', path.join(out, 'api')], { cwd, stdio: 'inherit' });
  const index = path.join(out, 'index.html');
  const links = [...(app ? [['../', 'App']] : []), ['dashboard.html', 'Dashboard'], ...(api ? [['api/', 'API docs']] : [])];
  if (!fs.existsSync(index))
    fs.writeFileSync(index, links.length === 1
      ? '<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=dashboard.html">\n<a href="dashboard.html">Dashboard</a>\n'
      : `<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width">\n<title>Project</title>\n<ul>\n${links.map(([h, t]) => `  <li><a href="${h}">${t}</a></li>\n`).join('')}</ul>\n`);
  console.log(`Dashboard: ${path.join(out, 'dashboard.html')}`);
}

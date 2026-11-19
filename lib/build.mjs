import fs from 'node:fs';
import path from 'node:path';
import { snapshot } from './snapshot.mjs';
import { readRecord } from './manifest.mjs';
import { projectData, renderDashboard } from './render.mjs';

export async function build({ cwd, out = '_site', pages, name }) {
  out = path.resolve(cwd, out);
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
  const index = path.join(out, 'index.html');
  if (!fs.existsSync(index))
    fs.writeFileSync(index, '<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=dashboard.html">\n<a href="dashboard.html">Dashboard</a>\n');
  console.log(`Dashboard: ${path.join(out, 'dashboard.html')}`);
}

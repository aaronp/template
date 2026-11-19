import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRecord } from './manifest.mjs';
import { resolveBin, snapshot } from './snapshot.mjs';
import { projectData, renderDashboard } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.css': 'text/css' };
// Reloads the dashboard when the cards change. Only served locally.
const reloader = `(() => { let v; setInterval(() => fetch('/version').then((r) => r.text()).then((n) => { if (v !== undefined && n !== v) location.reload(); v = n; }).catch(() => {}), 1000); })();`;

// Serves the dashboard and docs/ as GitHub Pages would, plus local editors (one per recorded tool) and live reload of cards.
export async function dev({ cwd, port = 8000, pages }) {
  try { await snapshot({ cwd, pages }); } catch (e) { console.warn(`snapshot: ${e.message.trim()}`); }
  const local = {};
  const tools = readRecord(cwd).tools;
  const children = tools.map((entry, i) => {
    const child = spawn(process.execPath, [resolveBin(cwd, entry), entry.file], {
      cwd, env: { ...process.env, PORT: String(port + 1 + i), NO_OPEN: '1' }, stdio: ['ignore', 'pipe', 'inherit'], detached: true
    });
    // Each tool prints the URL it serves the file at; that is the link (it knows its own ?src= route).
    child.stdout.on('data', (d) => {
      const url = String(d).match(/https?:\/\/\S+/)?.[0];
      if (url && !local[entry.file]) { local[entry.file] = url; console.log(`  ${entry.file.padEnd(28)} ${url}`); }
    });
    child.on('error', (e) => console.error(`${entry.id}: ${e.message}`));
    return child;
  });
  // Each editor runs in its own process group and is stopped as a group, so no wrapper leaves a server behind.
  process.on('exit', () => children.forEach((c) => { try { process.kill(-c.pid, 'SIGTERM'); } catch {} }));
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => process.exit(0));

  // Inputs only: card.json, badges and cards.js are outputs, so a rebuild can't retrigger itself.
  let version = 0, timer;
  if (children.length && fs.existsSync(path.join(cwd, 'docs'))) fs.watch(path.join(cwd, 'docs'), { recursive: true }, (_, name) => {
    if (!name || !/\.md$|\.card\.json$|deck\.json$/i.test(name)) return;
    clearTimeout(timer); // editors write a temp file then rename; settle before rebuilding
    timer = setTimeout(async () => {
      try {
        await snapshot({ cwd, pages, force: false });
        version++;
        console.log(`  rebuilt cards (${name})`);
      } catch (e) { console.error(`  snapshot failed after ${name} changed: ${e.message}`); }
    }, 300);
  }).on('error', (e) => console.error(`  not watching docs/: ${e.message}`));

  const send = (res, code, body, headers = {}) => { res.writeHead(code, headers); res.end(body); };
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Bad request'); }
    const js = { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' };
    try {
      if (p === '/version') return send(res, 200, String(version), { 'Cache-Control': 'no-store' });
      if (p === '/local.js') return send(res, 200, `window.LOCAL = ${JSON.stringify(local)};\n${children.length ? reloader : ''}\n`, js);
      if (p === '/project.js') return send(res, 200, `window.PROJECT = ${JSON.stringify(projectData({ cwd, pages }))};\n`, js);
      if (p === '/' || p === '/dashboard.html')
        return send(res, 200, renderDashboard(projectData({ cwd, pages }), { inline: false }), { 'Content-Type': 'text/html', ...(p === '/' && { 'Cache-Control': 'no-store' }) });
    } catch (e) { return send(res, 500, String(e.message)); }
    if (p.includes('..')) return send(res, 404, 'Not found');
    // Only docs/ from the project (CORS * lets the hosted viewers read it); never the rest of the repo.
    const base = p.startsWith('/vendor/') || p === '/support.js' ? root : p.startsWith('/docs/') ? cwd : null;
    if (!base) return send(res, 404, 'Not found');
    let file = path.join(base, p.endsWith('/') ? p + 'index.html' : p);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
    const type = TYPES[path.extname(file).toLowerCase()];
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', ...(type && { 'Content-Type': type }) });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log(`Dashboard: ${url} (Ctrl-C to stop)${children.length ? '; local editors:' : ''}`);
    // Same convention as the tools: NO_OPEN=1 skips the browser.
    if (process.env.NO_OPEN) return;
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  });
  return server;
}

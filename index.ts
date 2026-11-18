// Serves the repo as GitHub Pages would, with / → index.html.
// CORS is open so hosted viewers can read docs/ from localhost.
//
// Local mode: each argument is <tool-bin>:<file.md> (make dev passes them). Each tool's own server is started
// on PORT+1, PORT+2, … (it edits that file and saves back), and /local.js tells the dashboard where they are:
// window.LOCAL = { '<file.md>': '<local editor url>' }. Pages has no local.js, so there cards link to the hosted tools.
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 8000);
const local: Record<string, string> = {};
const children = process.argv.slice(2).map((arg, i) => {
  const at = arg.lastIndexOf(':');
  const [bin, md] = [arg.slice(0, at), arg.slice(at + 1)];
  const [cmd, ...pre] = bin.split(" ");
  const child = spawn(cmd, [...pre, md], { env: { ...process.env, PORT: String(PORT + 1 + i), NO_OPEN: '1' }, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  // Each tool prints the URL it serves the file at; that is the link (it knows its own ?src= route).
  child.stdout.on('data', (d) => {
    const url = String(d).match(/https?:\/\/\S+/)?.[0];
    if (url && !local[md]) { local[md] = url; console.log(`  ${md.padEnd(28)} ${url}`); }
  });
  child.on('error', (e) => console.error(`${bin}: ${e.message} (bun install?)`));
  return child;
});
// Each editor runs in its own process group (detached) and is stopped as a group, so no wrapper leaves a server behind.
process.on('exit', () => children.forEach((c) => { try { process.kill(-c.pid!, 'SIGTERM'); } catch {} }));
process.on('SIGINT', () => process.exit(0)).on('SIGTERM', () => process.exit(0));

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path === '/local.js') return new Response(`window.LOCAL = ${JSON.stringify(local)};\n`, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
    const file = Bun.file('.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (path.includes('..') || !(await file.exists())) return new Response('Not found', { status: 404 });
    return new Response(file, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
console.log(`Dashboard on ${server.url.href} (Ctrl-C to stop)${children.length ? '; local editors:' : ''}`);

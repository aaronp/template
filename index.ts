// Serves the repo as GitHub Pages would, with / → index.html.
// CORS is open so the hosted ADR viewer can read docs/ from localhost.
const server = Bun.serve({
  port: Number(process.env.PORT ?? 8000),
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const file = Bun.file('.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (path.includes('..') || !(await file.exists())) return new Response('Not found', { status: 404 });
    return new Response(file, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
console.log(`Dashboard on ${server.url.href} (Ctrl-C to stop)`);

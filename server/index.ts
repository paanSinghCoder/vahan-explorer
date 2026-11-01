// Local server: runs the API (server/api.ts) and, in production, serves the built React
// app from dist/. On Vercel the same API runs as functions from api/ instead.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { handleApi } from './api.js';

const PORT = Number(process.env.PORT ?? 5174);
const DIST = join(import.meta.dirname, '..', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(res: ServerResponse, path: string) {
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Run `pnpm build` first, or use `pnpm dev`.');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (!path.startsWith('/api/')) return serveStatic(res, path);
  const response = await handleApi(await toRequest(req));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

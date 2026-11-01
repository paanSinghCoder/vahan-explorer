// API server: proxies the Vahan report page (which cannot be called from a browser on
// another origin) and, in production, serves the built React app from dist/.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { Meta, ReportFilters, ReportResult, StateDetail } from '../shared/types.ts';
import { limit, TtlCache } from './cache.ts';
import { fetchMeta, fetchReport, fetchStateDetail } from './vahan/report.ts';
import { UpstreamError, ValidationError } from './vahan/session.ts';

const PORT = Number(process.env.PORT ?? 5174);
const DIST = join(import.meta.dirname, '..', 'dist');
const HOUR = 3_600_000;

const metaCache = new TtlCache<Meta>(12 * HOUR, 1);
const stateCache = new TtlCache<StateDetail>(12 * HOUR, 64);
const reportCache = new TtlCache<Omit<ReportResult, 'cached' | 'tookMs'>>(0.5 * HOUR, 200);
const upstream = limit(2);

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function normaliseFilters(f: Partial<ReportFilters>): ReportFilters {
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
  const checks: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(f.checks ?? {})) {
    if (Array.isArray(v) && v.length) checks[k] = v.map(String).sort();
  }
  return {
    state: str(f.state, '-1'),
    rto: str(f.rto, '-1'),
    yAxis: str(f.yAxis),
    xAxis: str(f.xAxis),
    yearType: str(f.yearType),
    year: str(f.year),
    years: Array.isArray(f.years) ? f.years.map(String).sort() : [],
    tableGroup: str(f.tableGroup),
    checks,
  };
}

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  if (req.method === 'GET' && path === '/api/meta') {
    return send(res, 200, await metaCache.get('meta', () => upstream(fetchMeta)));
  }
  const state = path.match(/^\/api\/state\/([A-Z]{2})$/);
  if (req.method === 'GET' && state) {
    return send(res, 200, await stateCache.get(state[1], () => upstream(() => fetchStateDetail(state[1]))));
  }
  if (req.method === 'POST' && path === '/api/report') {
    const filters = normaliseFilters(await readJson<Partial<ReportFilters>>(req));
    const key = JSON.stringify(filters);
    const cached = reportCache.has(key);
    const started = Date.now();
    const report = await reportCache.get(key, () => upstream(() => fetchReport(filters)));
    const body: ReportResult = { ...report, cached, tookMs: Date.now() - started };
    return send(res, 200, body);
  }
  send(res, 404, { error: 'Not found' });
}

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
  if (!existsSync(file)) return send(res, 404, { error: 'Run `pnpm build` first, or use `pnpm dev`.' });
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const started = Date.now();
  try {
    if (path.startsWith('/api/')) await api(req, res, path);
    else serveStatic(res, path);
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : err instanceof UpstreamError ? 502 : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${status}] ${req.method} ${path}: ${message}`);
    if (!res.headersSent) send(res, status, { error: message });
  } finally {
    if (path.startsWith('/api/')) console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  }
}).listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

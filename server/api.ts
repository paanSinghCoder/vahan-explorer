// The API, written against the Web Request/Response API so the same code serves the
// local Node server (server/index.ts) and the Vercel functions (api/).
import type { Meta, ReportFilters, ReportResult, StateDetail } from '../shared/types.js';
import { limit, TtlCache } from './cache.js';
import { fetchMeta, fetchReport, fetchStateDetail } from './vahan/report.js';
import { UpstreamError, ValidationError } from './vahan/session.js';

const HOUR = 3_600_000;

// Module-level, so they persist across requests while an instance stays warm.
const metaCache = new TtlCache<Meta>(12 * HOUR, 1);
const stateCache = new TtlCache<StateDetail>(12 * HOUR, 64);
const reportCache = new TtlCache<Omit<ReportResult, 'cached' | 'tookMs'>>(0.5 * HOUR, 200);
const upstream = limit(2);

/** Filter options change rarely, so let a CDN (e.g. Vercel's) cache GET responses. */
const CDN_CACHE = 'public, max-age=0, s-maxage=43200, stale-while-revalidate=86400';

function json(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
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
    month: str(f.month),
    tableGroup: str(f.tableGroup),
    checks,
  };
}

async function route(request: Request, path: string): Promise<Response> {
  if (request.method === 'GET' && path === '/api/meta') {
    return json(200, await metaCache.get('meta', () => upstream(fetchMeta)), CDN_CACHE);
  }
  const state = path.match(/^\/api\/state\/([A-Z]{2})$/);
  if (request.method === 'GET' && state) {
    return json(200, await stateCache.get(state[1], () => upstream(() => fetchStateDetail(state[1]))), CDN_CACHE);
  }
  if (request.method === 'POST' && path === '/api/report') {
    const filters = normaliseFilters((await request.json().catch(() => ({}))) as Partial<ReportFilters>);
    const key = JSON.stringify(filters);
    const cached = reportCache.has(key);
    const started = Date.now();
    const report = await reportCache.get(key, () => upstream(() => fetchReport(filters)));
    return json(200, { ...report, cached, tookMs: Date.now() - started } satisfies ReportResult);
  }
  return json(404, { error: 'Not found' });
}

export async function handleApi(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const started = Date.now();
  let response: Response;
  try {
    response = await route(request, path);
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : err instanceof UpstreamError ? 502 : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${status}] ${request.method} ${path}: ${message}`);
    response = json(status, { error: message });
  }
  console.log(`${request.method} ${path} ${response.status} ${Date.now() - started}ms`);
  return response;
}

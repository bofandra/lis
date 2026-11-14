import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ResultStore } from './store.mjs';
import { fixtures, orders } from './fixtures.mjs';
import { scenarios } from './simulator.mjs';
import { startTransports } from './transports.mjs';

const publicDir = new URL('../public/', import.meta.url);
const contentTypes = { '/': 'text/html; charset=utf-8', '/app.js': 'text/javascript; charset=utf-8', '/styles.css': 'text/css; charset=utf-8' };
const allowedFiles = { '/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
const maxBody = 256 * 1024 + 1024;

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

async function requestBody(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk.toString('utf8');
    if (Buffer.byteLength(value, 'utf8') > maxBody) {
      const err = new Error('Request is too large');
      err.status = 413;
      throw err;
    }
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Body must be a JSON object');
    return parsed;
  } catch {
    const err = new Error('Body must be a JSON object');
    err.status = 400;
    throw err;
  }
}

export function createApp(store = new ResultStore()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    try {
      if (req.method === 'GET' && pathname === '/health')
        return json(res, 200, { ok: true, app: 'hosnex-lis-prototype', mode: 'prototype' });
      if (req.method === 'GET' && pathname === '/api/instruments')
        return json(res, 200, { items: store.registry.list() });
      if (req.method === 'POST' && pathname === '/api/instruments')
        return json(res, 201, { instrument: store.registry.create(await requestBody(req)) });
      if (pathname.startsWith('/api/instruments/')) {
        const id = decodeURIComponent(pathname.slice('/api/instruments/'.length));
        if (req.method === 'GET') {
          const instrument = store.registry.get(id);
          return json(res, instrument ? 200 : 404, instrument || { error: 'Instrument not found' });
        }
        if (req.method === 'PATCH')
          return json(res, 200, { instrument: store.registry.update(id, await requestBody(req)) });
      }
      if (req.method === 'GET' && pathname === '/api/orders')
        return json(res, 200, { items: orders });
      if (req.method === 'GET' && pathname === '/api/fixtures')
        return json(res, 200, fixtures);
      if (req.method === 'GET' && pathname === '/api/simulator/scenarios')
        return json(res, 200, { items: scenarios });
      if (req.method === 'GET' && pathname === '/api/worklist') {
        const instrumentId = url.searchParams.get('instrumentId');
        if (!instrumentId) return json(res, 400, { error: 'instrumentId is required' });
        return json(res, 200, store.worklist(instrumentId, url.searchParams.get('sampleId')));
      }
      if (req.method === 'POST' && pathname === '/api/worklist/query') {
        const body = await requestBody(req);
        if (typeof body.instrumentId !== 'string') return json(res, 400, { error: 'instrumentId is required' });
        return json(res, 200, store.worklist(body.instrumentId, body.sampleId || null));
      }
      if (req.method === 'GET' && pathname === '/api/results')
        return json(res, 200, { items: store.list(), stats: store.stats() });
      if (req.method === 'GET' && pathname.startsWith('/api/results/')) {
        const record = store.find(decodeURIComponent(pathname.split('/').at(-1)));
        return json(res, record ? 200 : 404, record || { error: 'Result not found' });
      }
      if (req.method === 'POST' && pathname === '/api/ingest') {
        const body = await requestBody(req);
        const result = store.ingest(body);
        return json(res, result.duplicate ? 200 : 201, result);
      }
      if (req.method === 'POST' && pathname === '/api/simulate') {
        const body = await requestBody(req);
        const result = store.simulate(body.protocol, { instrumentId: body.instrumentId, scenario: body.scenario });
        return json(res, result.duplicate ? 200 : 201, result);
      }
      if (req.method === 'GET' && allowedFiles[pathname]) {
        const content = await readFile(new URL(allowedFiles[pathname], publicDir));
        res.writeHead(200, { 'Content-Type': contentTypes[pathname], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        return res.end(content);
      }
      return json(res, 404, { error: 'Route not found' });
    } catch (error) {
      const status = error.status || 400;
      return json(res, status, { error: error.message || 'Unknown error' });
    }
  });
}

const directExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (directExecution) {
  const store = new ResultStore();
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4000);
  const app = createApp(store);
  app.listen(port, host, () => {
    console.log('LIS demo listening at http://' + host + ':' + port);
    console.log('Synthetic sample only; do not use for clinical care.');
    startTransports(store).catch(error => console.error('Transport startup failed:', error.message));
  });
}

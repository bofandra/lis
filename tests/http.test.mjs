import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.mjs';
import { ResultStore } from '../src/store.mjs';

test('REST: health, synthetic simulation, duplicate protection and results', async () => {
  const server = createApp(new ResultStore());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = body => fetch(base + '/api/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    const health = await (await fetch(base + '/health')).json();
    assert.equal(health.ok, true);
    const first = await post({ protocol: 'ASTM' });
    assert.equal(first.status, 201);
    const saved = await first.json();
    assert.equal(saved.record.status, 'PENDING_REVIEW');
    const repeat = await post({ protocol: 'ASTM' });
    assert.equal(repeat.status, 200);
    assert.equal((await repeat.json()).duplicate, true);
    const results = await (await fetch(base + '/api/results')).json();
    assert.equal(results.stats.total, 1);
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Analyzer integration/);
    const invalid = await fetch(base + '/api/ingest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: 'CSV', raw: 'x', instrumentId: 'chem-astm-01' })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

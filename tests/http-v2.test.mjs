import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.mjs';
import { ResultStore } from '../src/store.mjs';

test('HTTP: instrument config + simulator + worklist API', async () => {
  const server = createApp(new ResultStore());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (path, method, data) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  try {
    const devices = await (await fetch(base + '/api/instruments')).json();
    assert.equal(devices.items.length, 2);
    const created = await request('/api/instruments', 'POST', {
      id: 'hema-demo-03', name: 'Other hema', vendor: 'Generic', model: 'H1',
      protocol: 'HL7', transport: 'TCP_MLLP',
      connection: { host: '127.0.0.1', port: 2576 },
      enabled: true, supportsOrderDownload: false
    });
    assert.equal(created.status, 201);
    const duplicate = await request('/api/instruments', 'POST', {
      id: 'hema-demo-03', name: 'Other hema', vendor: 'Generic', model: 'H1',
      protocol: 'HL7', transport: 'TCP_MLLP', connection: { host: '127.0.0.1', port: 2576 },
      enabled: true, supportsOrderDownload: false
    });
    assert.equal(duplicate.status, 409);
    const patch = await request('/api/instruments/hema-demo-03', 'PATCH', { supportsOrderDownload: true });
    assert.equal(patch.status, 200);
    const worklist = await (await fetch(base + '/api/worklist?instrumentId=hema-demo-03')).json();
    assert.equal(worklist.items.length, 1);
    const first = await request('/api/simulate', 'POST', {
      instrumentId: 'hema-demo-03', protocol: 'HL7', scenario: 'abnormal'
    });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).record.observations[0].flag, 'L');
    const result = await request('/api/simulate', 'POST', {
      instrumentId: 'hema-demo-03', protocol: 'HL7', scenario: 'duplicate'
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).duplicate, true);
    const noToken = await (await fetch(base + '/api/simulator/scenarios')).json();
    assert.equal(noToken.items.length, 5);
    const ui = await (await fetch(base + '/')).text();
    assert.match(ui, /Instrument configuration/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

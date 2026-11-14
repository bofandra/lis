import test from 'node:test';
import assert from 'node:assert/strict';
import { InstrumentRegistry } from '../src/instruments.mjs';

test('registry initializes two device profiles with status CONFIGURED_ONLY', () => {
  const registry = new InstrumentRegistry();
  assert.equal(registry.list().length, 2);
  assert.equal(registry.get('chem-astm-01').transport, 'TCP_ASTM');
  assert.equal(registry.get('hema-hl7-01').status, 'CONFIGURED_ONLY');
});

test('serial RS-232 profile validates metadata without opening a connection', () => {
  const registry = new InstrumentRegistry();
  const created = registry.create({
    id: 'lab-serial-03', name: 'Generic Serial', vendor: 'Generic', model: 'Model A',
    protocol: 'ASTM', transport: 'SERIAL_RS232',
    connection: { path: '/dev/ttyUSB0', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
    enabled: true, supportsOrderDownload: false
  });
  assert.equal(created.connection.path, '/dev/ttyUSB0');
  assert.equal(created.status, 'CONFIGURED_ONLY');
  const changed = registry.update('lab-serial-03', { enabled: false });
  assert.equal(changed.enabled, false);
  assert.equal(registry.get('lab-serial-03').enabled, false);
});

test('validation rejects duplicate IDs, unsupported combinations and bad patches', () => {
  const registry = new InstrumentRegistry();
  assert.throws(() => registry.create(registry.get('chem-astm-01')), /already exists/);
  assert.throws(() => registry.update('hema-hl7-01', { transport: 'TCP_ASTM' }), /HL7 requires/);
  assert.throws(() => registry.update('hema-hl7-01', { id: 'overwrite' }), /Cannot update field id/);
  assert.throws(() => registry.update('missing', { enabled: true }), /not found/);
  assert.throws(() => registry.update('chem-astm-01', { connection: { host: 'http://localhost', port: 4000 } }), /Invalid host/);
  assert.throws(() => registry.update('chem-astm-01', { connection: { host: '127.0.0.1', port: 70000 } }), /between 1 and 65535/);
});

test('read returns defensive copy', () => {
  const registry = new InstrumentRegistry();
  const a = registry.get('chem-astm-01');
  a.connection.port = 42;
  assert.equal(registry.get('chem-astm-01').connection.port, 5001);
});

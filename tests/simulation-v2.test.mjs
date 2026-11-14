import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultStore } from '../src/store.mjs';

test('multiple simulated normal messages are unique and matched', () => {
  const store = new ResultStore();
  const one = store.simulate('ASTM', { scenario: 'normal' });
  const two = store.simulate('ASTM', { scenario: 'normal' });
  assert.equal(one.duplicate, false);
  assert.equal(two.duplicate, false);
  assert.notEqual(one.record.id, two.record.id);
  assert.equal(store.stats().pendingReview, 2);
});

test('abnormal simulator produces flags and still requires review', () => {
  const store = new ResultStore();
  const chemistry = store.simulate('ASTM', { scenario: 'abnormal' }).record;
  const hematology = store.simulate('HL7', { scenario: 'abnormal' }).record;
  assert.equal(chemistry.observations[0].flag, 'H');
  assert.equal(hematology.observations[0].flag, 'L');
  assert.equal(chemistry.status, 'PENDING_REVIEW');
});

test('worklist query returns synthetic orders compatible with analyzer', () => {
  const store = new ResultStore();
  const chem = store.worklist('chem-astm-01');
  assert.equal(chem.mode, 'SIMULATED_ORDER_QUERY');
  assert.equal(chem.items[0].sampleId, 'SP-1001');
  assert.equal(store.worklist('hema-hl7-01').items[0].sampleId, 'SP-1002');
  assert.equal(store.worklist('hema-hl7-01', 'SP-1001').items.length, 0);
});

test('unknown sample, mismatch and resend have distinct outcomes', () => {
  const store = new ResultStore();
  assert.equal(store.simulate('HL7', { scenario: 'unknown-sample' }).record.status, 'UNMATCHED_ORDER');
  assert.equal(store.simulate('HL7', { scenario: 'patient-mismatch' }).record.status, 'PATIENT_MISMATCH');
  const replay = store.simulate('HL7', { scenario: 'duplicate' });
  assert.equal(replay.duplicate, true);
  assert.equal(store.stats().total, 2);
});

test('disabled device blocks ingest, and bidirectional flag gates worklist', () => {
  const store = new ResultStore();
  store.registry.update('chem-astm-01', { supportsOrderDownload: false });
  assert.throws(() => store.worklist('chem-astm-01'), /disabled for this instrument/);
  store.registry.update('chem-astm-01', { enabled: false });
  assert.throws(() => store.simulate('ASTM', { scenario: 'normal' }), /disabled/);
});

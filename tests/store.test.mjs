import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultStore } from '../src/store.mjs';
import { astmFixture, hl7Fixture } from '../src/fixtures.mjs';

test('matched chemistry sample remains pending manual review', () => {
  const store = new ResultStore();
  const { record } = store.ingest({ protocol: 'ASTM', instrumentId: 'chem-astm-01', raw: astmFixture });
  assert.equal(record.matchedOrderId, 'ORD-0001');
  assert.equal(record.status, 'PENDING_REVIEW');
  assert.equal(store.stats().pendingReview, 1);
});

test('replay of the same instrument message is idempotent', () => {
  const store = new ResultStore();
  const payload = { protocol: 'HL7', instrumentId: 'hema-hl7-01', raw: hl7Fixture };
  const first = store.ingest(payload);
  const second = store.ingest(payload);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.record.id, second.record.id);
  assert.equal(store.list().length, 1);
});

test('unknown order creates unmatched status and never releases results', () => {
  const store = new ResultStore();
  const { record } = store.ingest({ protocol: 'ASTM', instrumentId: 'chem-astm-01', raw: astmFixture.replace('SP-1001', 'SP-UNKNOWN') });
  assert.equal(record.status, 'UNMATCHED_ORDER');
  assert.equal(record.matchedOrderId, null);
});

test('patient mismatch is highlighted for review', () => {
  const store = new ResultStore();
  const { record } = store.ingest({ protocol: 'HL7', instrumentId: 'hema-hl7-01', raw: hl7Fixture.replace('DEMO-PAT-002', 'OTHER-PAT') });
  assert.equal(record.status, 'PATIENT_MISMATCH');
});

test('instrument and protocol must agree', () => {
  const store = new ResultStore();
  assert.throws(() => store.ingest({ protocol: 'HL7', instrumentId: 'chem-astm-01', raw: hl7Fixture }), /does not match/);
});

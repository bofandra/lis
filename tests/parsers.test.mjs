import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAstm, parseHl7, parseAnalyzerMessage } from '../src/parsers.mjs';
import { astmFixture, hl7Fixture } from '../src/fixtures.mjs';

test('ASTM: maps sample and chemistry results', () => {
  const value = parseAstm(astmFixture);
  assert.equal(value.sampleId, 'SP-1001');
  assert.equal(value.patientId, 'DEMO-PAT-001');
  assert.equal(value.observations.length, 2);
  assert.equal(value.observations[0].code, 'GLU');
  assert.equal(value.observations[0].value, '98');
  assert.equal(value.observations[0].loincDemo, '2345-7');
});

test('HL7 ORU: maps specimen, control ID and OBX results', () => {
  const value = parseHl7(hl7Fixture);
  assert.equal(value.sampleId, 'SP-1002');
  assert.equal(value.patientId, 'DEMO-PAT-002');
  assert.equal(value.messageId, 'MSG-DEMO-0001');
  assert.equal(value.observations.length, 2);
  assert.equal(value.observations[0].code, 'HGB');
  assert.equal(value.observations[1].value, '7.8');
});

test('HL7 MLLP envelope can be stripped for parsing', () => {
  const value = parseHl7('\x0b' + hl7Fixture + '\x1c\r');
  assert.equal(value.sampleId, 'SP-1002');
});

test('missing results are rejected rather than silently accepted', () => {
  assert.throws(() => parseAstm('H|\\^&\rO|1|SP-01\rL|1|N\r'), /No ASTM R records/);
  assert.throws(() => parseHl7('MSH|^~\\&|DEV|LAB|LIS|LAB|20261114||ORU^R01|X|P|2.3\rOBR|1|ORD|SP-01\r'), /No OBX/);
});

test('unknown protocols are explicitly rejected', () => {
  assert.throws(() => parseAnalyzerMessage('CSV', astmFixture), /Unsupported protocol/);
});

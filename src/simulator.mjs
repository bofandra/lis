import { randomUUID } from 'node:crypto';
import { astmFixture, hl7Fixture } from './fixtures.mjs';

// Scenarios only use synthetic records. "duplicate" is handled by ResultStore.
export const scenarios = [
  { id: 'normal', label: 'Normal result', description: 'Matched specimen with normal values' },
  { id: 'abnormal', label: 'Abnormal result', description: 'Matched specimen with abnormal indicator' },
  { id: 'unknown-sample', label: 'Unknown specimen', description: 'No matching LIS order' },
  { id: 'patient-mismatch', label: 'Patient mismatch', description: 'Known specimen but different demo patient ID' },
  { id: 'duplicate', label: 'Resend previous', description: 'Identical payload; must not create another record' }
];

const validScenarios = new Set(scenarios.map(x => x.id));

export function renderSyntheticMessage(instrument, scenario = 'normal') {
  if (!validScenarios.has(scenario) || scenario === 'duplicate')
    throw new Error('Invalid payload-generation scenario');
  if (!instrument || !['ASTM', 'HL7'].includes(instrument.protocol))
    throw new Error('Simulator only supports ASTM or HL7');

  // Use a unique control ID or an ASTM header token so each generated test
  // message exercises normal ingest instead of the exact-byte replay path.
  const id = randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase();
  if (instrument.protocol === 'ASTM') {
    let raw = astmFixture.replace('CHEMISTRY-DEVICE', 'CHEMISTRY-' + id);
    if (scenario === 'abnormal') raw = raw.replace('R|1|^^^GLU|98|mg/dL|70-110|N', 'R|1|^^^GLU|186|mg/dL|70-110|H');
    if (scenario === 'unknown-sample') raw = raw.replace('SP-1001', 'SP-UNMATCHED');
    if (scenario === 'patient-mismatch') raw = raw.replace('DEMO-PAT-001', 'DEMO-PAT-OTHER');
    return raw;
  }
  let raw = hl7Fixture.replace('MSG-DEMO-0001', 'MSG-' + id);
  if (scenario === 'abnormal') raw = raw.replace('OBX|1|NM|HGB^Hemoglobin||13.4|g/dL|12.0-16.0|N', 'OBX|1|NM|HGB^Hemoglobin||8.2|g/dL|12.0-16.0|L');
  if (scenario === 'unknown-sample') raw = raw.replace('SP-1002', 'SP-UNMATCHED');
  if (scenario === 'patient-mismatch') raw = raw.replace('DEMO-PAT-002', 'DEMO-PAT-OTHER');
  return raw;
}

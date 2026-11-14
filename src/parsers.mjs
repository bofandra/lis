// Small, dependency-free *prototype* parsers for selected ASTM E1394-style
// records and HL7 v2 ORU^R01. Vendor-specific dialects require adapters.
const demoLoinc = {
  GLU: '2345-7',
  CREA: '2160-0',
  HGB: '718-7',
  WBC: '6690-2'
};

function observation(code, display, value, unit, referenceRange, flag) {
  const trimmed = String(code || '').trim();
  if (!trimmed) throw new Error('Result code is missing');
  return {
    code: trimmed,
    display: display || trimmed,
    value: String(value ?? ''),
    unit: unit || '',
    referenceRange: referenceRange || '',
    flag: flag || '',
    loincDemo: demoLoinc[trimmed.toUpperCase()] || null
  };
}

function hl7Lines(raw) {
  const clean = raw.replace(/^\x0b/, '').replace(/\x1c\r?$/, '');
  return clean.replace(/\r\n/g, '\r').replace(/\n/g, '\r')
    .split('\r').map(line => line.trim()).filter(Boolean);
}

export function parseHl7(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('HL7 payload is empty');
  const lines = hl7Lines(raw);
  const msh = (lines.find(line => line.startsWith('MSH|')) || '').split('|');
  if (msh.length < 10) throw new Error('HL7 MSH segment not found');
  if (!msh[8]?.startsWith('ORU^R01')) throw new Error('Only HL7 ORU^R01 is supported by this demo');
  const obr = (lines.find(line => line.startsWith('OBR|')) || '').split('|');
  const pid = (lines.find(line => line.startsWith('PID|')) || '').split('|');
  const sampleId = (obr[3] || '').split('^')[0] || (obr[2] || '').split('^')[0];
  if (!sampleId) throw new Error('Missing specimen ID in OBR-3/OBR-2');
  const results = lines.filter(line => line.startsWith('OBX|')).map(line => {
    const f = line.split('|');
    const id = (f[3] || '').split('^');
    return observation(id[0], id[1], f[5], f[6], f[7], f[8]);
  });
  if (!results.length) throw new Error('No OBX segments found');
  return {
    protocol: 'HL7',
    sampleId,
    orderId: (obr[2] || '').split('^')[0] || null,
    patientId: (pid[3] || '').split('^')[0] || null,
    messageId: msh[9] || null,
    observations: results
  };
}

export function parseAstm(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('ASTM payload is empty');
  const lines = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r')
    .split('\r').map(line => line.trim()).filter(Boolean);
  if (!lines.some(line => line.startsWith('H|'))) throw new Error('ASTM header record H missing');
  const order = (lines.find(line => line.startsWith('O|')) || '').split('|');
  const patient = (lines.find(line => line.startsWith('P|')) || '').split('|');
  const sampleId = (order[2] || '').split('^')[0];
  if (!sampleId) throw new Error('Missing specimen ID in ASTM O record');
  const results = lines.filter(line => line.startsWith('R|')).map(line => {
    const f = line.split('|');
    const parts = (f[2] || '').split('^').filter(Boolean);
    const code = parts.at(-1) || '';
    return observation(code, code, f[3], f[4], f[5], f[6]);
  });
  if (!results.length) throw new Error('No ASTM R records found');
  return {
    protocol: 'ASTM',
    sampleId,
    orderId: null,
    patientId: patient[3] || null,
    messageId: null,
    observations: results
  };
}

export function parseAnalyzerMessage(protocol, raw) {
  if (protocol === 'HL7') return parseHl7(raw);
  if (protocol === 'ASTM') return parseAstm(raw);
  throw new Error('Unsupported protocol; expected ASTM or HL7');
}

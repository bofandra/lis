// Synthetic, non-patient data only. These demonstrate common message shapes,
// not vendor-certified protocols.
export const instruments = [
  { id: 'chem-astm-01', name: 'Chemistry Analyzer (demo)', protocol: 'ASTM', transport: 'TCP / RS-232' },
  { id: 'hema-hl7-01', name: 'Hematology Analyzer (demo)', protocol: 'HL7', transport: 'TCP MLLP' }
];

export const orders = [
  { orderId: 'ORD-0001', sampleId: 'SP-1001', patientId: 'DEMO-PAT-001', panel: 'Kimia klinik', status: 'ORDERED' },
  { orderId: 'ORD-0002', sampleId: 'SP-1002', patientId: 'DEMO-PAT-002', panel: 'Darah lengkap', status: 'ORDERED' }
];

export const astmFixture = [
  'H|\\^&|||CHEMISTRY-DEVICE|||||P|1',
  'P|1||DEMO-PAT-001',
  'O|1|SP-1001||^^^CHEM',
  'R|1|^^^GLU|98|mg/dL|70-110|N',
  'R|2|^^^CREA|0.85|mg/dL|0.70-1.30|N',
  'L|1|N'
].join('\r') + '\r';

export const hl7Fixture = [
  'MSH|^~\\&|HEMATOLOGY|LAB|HOSNEX|LIS|202611141200||ORU^R01|MSG-DEMO-0001|P|2.3.1',
  'PID|1||DEMO-PAT-002^^^HOSNEX^MR||DEMO^PATIENT',
  'OBR|1|ORD-0002|SP-1002|CBC^Complete Blood Count',
  'OBX|1|NM|HGB^Hemoglobin||13.4|g/dL|12.0-16.0|N|||F',
  'OBX|2|NM|WBC^White Blood Cells||7.8|10^3/uL|4.0-10.0|N|||F'
].join('\r') + '\r';

export const fixtures = {
  ASTM: { instrumentId: 'chem-astm-01', raw: astmFixture },
  HL7: { instrumentId: 'hema-hl7-01', raw: hl7Fixture }
};

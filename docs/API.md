# LIS Prototype v0.2 — API Contract

Base URL: http://127.0.0.1:4000

**Warning:** localhost demo only, no auth, in-memory state, synthetic patients. Do not use with real patients or clinical workflow.

## Device configuration

### GET /api/instruments
Returns \`{ "items": [Instrument, ...] }\`.

### GET /api/instruments/:id
Returns an Instrument or 404.

### POST /api/instruments
Creates an Instrument (201), unique ID required (409 otherwise).

### PATCH /api/instruments/:id
Patches one or more supported fields (200); no delete operation. ID immutable.

Instrument shape:

\`\`\`json
{
  "id": "chem-astm-01",
  "name": "Chemistry Analyzer (demo)",
  "vendor": "Generic demo",
  "model": "ASTM Chemistry",
  "protocol": "ASTM",
  "transport": "TCP_ASTM",
  "connection": { "host": "127.0.0.1", "port": 5001 },
  "enabled": true,
  "supportsOrderDownload": true,
  "status": "CONFIGURED_ONLY"
}
\`\`\`

Allowed \`protocol\`: \`ASTM\`, \`HL7\`.

Allowed \`transport\`: \`TCP_ASTM\`, \`TCP_MLLP\`, \`SERIAL_RS232\`.
For serial, connection is \`{path, baudRate, dataBits, stopBits, parity}\`; serial hardware reading is NOT implemented. An instrument cannot combine HL7 with TCP_ASTM or ASTM with TCP_MLLP.

\`status: CONFIGURED_ONLY\` always means **metadata registered, NOT connected/online**.

## Simulating results

### GET /api/simulator/scenarios
Returns scenario descriptors.

### POST /api/simulate

\`\`\`json
{ "protocol": "HL7", "instrumentId": "hema-hl7-01", "scenario": "abnormal" }
\`\`\`

Scenarios:
- \`normal\`: realistic normal synthetic values.
- \`abnormal\`: synthetic abnormal result, e.g. low HGB or high GLU.
- \`unknown-sample\`: specimen does not match any demo order.
- \`patient-mismatch\`: patient ID does not match demo LIS order.
- \`duplicate\`: exact-byte resend of previous simulated message for that instrument; 409 if no previous message.
- Scenario omitted: preserves legacy static fixture and deduplicates repeated requests.

Returns \`{ "duplicate": boolean, "record": ResultRecord }\`, with HTTP 201 for new results or 200 for duplicates.

### POST /api/ingest
Raw analyzer message:

\`\`\`json
{ "instrumentId": "hema-hl7-01", "protocol": "HL7", "raw": "MSH|...\\rOBR|...\\rOBX|..." }
\`\`\`

Message max size 256 KiB. Only a subset of standard ASTM and HL7 ORU formats is implemented.

### GET /api/results and GET /api/results/:id
Normalized worklist/result records. Possible statuses: \`PENDING_REVIEW\`, \`UNMATCHED_ORDER\`, \`PATIENT_MISMATCH\`. **No result release API**.

## Simulated analyzer order query

### GET /api/worklist?instrumentId=hema-hl7-01&sampleId=SP-1002
### POST /api/worklist/query

\`\`\`json
{ "instrumentId": "hema-hl7-01", "sampleId": "SP-1002" }
\`\`\`

Result:

\`\`\`json
{
  "instrumentId": "hema-hl7-01",
  "mode": "SIMULATED_ORDER_QUERY",
  "items": [{
    "orderId": "ORD-0002",
    "sampleId": "SP-1002",
    "patientId": "DEMO-PAT-002",
    "panel": "Darah lengkap",
    "status": "READY_FOR_ANALYZER_DEMO",
    "testCodes": [{ "code": "HGB", "display": "Hemoglobin" }]
  }]
}
\`\`\`

Disabled instruments or those with \`supportsOrderDownload=false\` return HTTP 409. Only demo orders are returned. **No HL7 QRY/DSR or ASTM Q-record exchange is transmitted to devices**.

## Out of scope

Persistence, authentication, full HL7 escaping, real device certification, RS-232 runtime agent, specimen lifecycle, QC, clinical validation, auto-release, FHIR and HOSNEX integration.

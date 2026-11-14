// Registry-only configuration. No network/serial connection is opened by
// creating or editing an instrument profile in the prototype.
const transportTypes = new Set(['TCP_ASTM', 'TCP_MLLP', 'SERIAL_RS232']);
const protocols = new Set(['ASTM', 'HL7']);
const parityModes = new Set(['none', 'even', 'odd']);

const templates = [
  {
    id: 'chem-astm-01', name: 'Chemistry Analyzer (demo)',
    vendor: 'Generic demo', model: 'ASTM Chemistry',
    protocol: 'ASTM', transport: 'TCP_ASTM',
    connection: { host: '127.0.0.1', port: 5001 },
    enabled: true, supportsOrderDownload: true
  },
  {
    id: 'hema-hl7-01', name: 'Hematology Analyzer (demo)',
    vendor: 'Generic demo', model: 'HL7 Hematology',
    protocol: 'HL7', transport: 'TCP_MLLP',
    connection: { host: '127.0.0.1', port: 2575 },
    enabled: true, supportsOrderDownload: true
  }
];

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function text(value, label, limit = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw invalid(label + ' must be a non-empty string (max ' + limit + ')');
  return value.trim();
}

function connectionFor(input, transport) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw invalid('connection must be an object');
  if (transport === 'SERIAL_RS232') {
    const path = text(input.path, 'connection.path', 120);
    if (!/^[A-Za-z0-9_.:/\\-]+$/.test(path)) throw invalid('Invalid serial path');
    const baudRate = Number(input.baudRate ?? 9600);
    const dataBits = Number(input.dataBits ?? 8);
    const stopBits = Number(input.stopBits ?? 1);
    const parity = input.parity ?? 'none';
    if (![1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].includes(baudRate))
      throw invalid('Unsupported baud rate');
    if (![7, 8].includes(dataBits) || ![1, 2].includes(stopBits) || !parityModes.has(parity))
      throw invalid('Unsupported serial framing');
    return { path, baudRate, dataBits, stopBits, parity };
  }
  const host = text(input.host ?? '127.0.0.1', 'connection.host', 253);
  // Connection is metadata only, but deliberately exclude URLs and path injection.
  if (!/^[a-zA-Z0-9.:-]+$/.test(host)) throw invalid('Invalid host');
  const port = Number(input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw invalid('connection.port must be between 1 and 65535');
  return { host, port };
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw invalid('Instrument must be an object');
  const id = text(input.id, 'id', 64);
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(id)) throw invalid('Invalid instrument ID');
  const name = text(input.name, 'name');
  const vendor = text(input.vendor, 'vendor', 80);
  const model = text(input.model, 'model', 80);
  if (!protocols.has(input.protocol)) throw invalid('Unsupported protocol');
  if (!transportTypes.has(input.transport)) throw invalid('Unsupported transport');
  if (input.protocol === 'ASTM' && input.transport === 'TCP_MLLP')
    throw invalid('ASTM requires TCP_ASTM or SERIAL_RS232 transport');
  if (input.protocol === 'HL7' && input.transport === 'TCP_ASTM')
    throw invalid('HL7 requires TCP_MLLP or SERIAL_RS232 transport');
  if (typeof input.enabled !== 'boolean' || typeof input.supportsOrderDownload !== 'boolean')
    throw invalid('enabled and supportsOrderDownload must be booleans');
  return {
    id, name, vendor, model, protocol: input.protocol, transport: input.transport,
    connection: connectionFor(input.connection, input.transport),
    enabled: input.enabled,
    supportsOrderDownload: input.supportsOrderDownload,
    status: 'CONFIGURED_ONLY'
  };
}

export class InstrumentRegistry {
  constructor(seed = templates) {
    this.devices = new Map();
    for (const instrument of seed) this.create(instrument);
  }

  list() { return [...this.devices.values()].map(device => structuredClone(device)); }

  get(id) {
    const value = this.devices.get(id);
    return value ? structuredClone(value) : null;
  }

  create(input) {
    const value = normalize(input);
    if (this.devices.has(value.id)) throw invalid('Instrument ID already exists', 409);
    this.devices.set(value.id, value);
    return this.get(value.id);
  }

  update(id, patch) {
    const current = this.get(id);
    if (!current) throw invalid('Instrument not found', 404);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw invalid('Patch must be an object');
    const allowed = new Set(['name', 'vendor', 'model', 'protocol', 'transport', 'connection', 'enabled', 'supportsOrderDownload']);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw invalid('Cannot update field ' + key);
    const updated = normalize({ ...current, ...patch, id });
    this.devices.set(id, updated);
    return this.get(id);
  }
}

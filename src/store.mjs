import { createHash, randomUUID } from 'node:crypto';
import { orders, fixtures } from './fixtures.mjs';
import { InstrumentRegistry } from './instruments.mjs';
import { renderSyntheticMessage } from './simulator.mjs';
import { getDemoWorklist } from './worklist.mjs';
import { parseAnalyzerMessage } from './parsers.mjs';

export class ResultStore {
  constructor(registry = new InstrumentRegistry()) {
    this.registry = registry;
    this.records = [];
    this.fingerprints = new Map();
    this.lastSimulated = new Map();
  }

  ingest({ protocol, instrumentId, raw }) {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('raw must be a non-empty string');
    if (Buffer.byteLength(raw, 'utf8') > 256 * 1024) throw new Error('Message exceeds 256 KiB');
    const instrument = this.registry.get(instrumentId);
    if (!instrument) throw new Error('Unknown instrumentId');
    if (!instrument.enabled) throw Object.assign(new Error('Instrument is disabled'), { status: 409 });
    if (protocol !== instrument.protocol) throw new Error('Protocol does not match the instrument');
    const normalized = parseAnalyzerMessage(protocol, raw);
    const hash = createHash('sha256').update(protocol + ':' + instrumentId + ':' + raw).digest('hex');
    const previous = this.fingerprints.get(hash);
    if (previous) return { duplicate: true, record: previous };
    const order = orders.find(item => item.sampleId === normalized.sampleId) || null;
    const patientMismatch = Boolean(order && normalized.patientId && order.patientId !== normalized.patientId);
    const record = {
      id: randomUUID(), receivedAt: new Date().toISOString(),
      instrumentId, instrumentName: instrument.name,
      protocol, ...normalized,
      matchedOrderId: order?.orderId || null,
      status: !order ? 'UNMATCHED_ORDER' : patientMismatch ? 'PATIENT_MISMATCH' : 'PENDING_REVIEW'
      // Raw patient messages deliberately excluded from API and not persisted.
    };
    this.records.unshift(record);
    this.fingerprints.set(hash, record);
    if (this.records.length > 500) {
      const keep = new Set(this.records.slice(0, 500).map(item => item.id));
      this.records = this.records.slice(0, 500);
      for (const [key, value] of this.fingerprints)
        if (!keep.has(value.id)) this.fingerprints.delete(key);
    }
    return { duplicate: false, record };
  }

  // No scenario = legacy, fixed fixture to preserve existing reproducible tests.
  // Explicit scenario = unique synthetic payload (except duplicate/replay).
  simulate(protocol, { instrumentId, scenario } = {}) {
    const fixture = fixtures[protocol];
    if (!fixture) throw new Error('Simulation supports only ASTM or HL7');
    const id = instrumentId || fixture.instrumentId;
    const instrument = this.registry.get(id);
    if (!instrument) throw Error('Unknown instrumentId');
    if (instrument.protocol !== protocol) throw Error('Protocol does not match the instrument');
    const key = id + ':' + protocol;
    let raw;
    if (!scenario) raw = fixture.raw;
    else if (scenario === 'duplicate') {
      raw = this.lastSimulated.get(key);
      if (!raw) throw Object.assign(new Error('No previous simulated message for this instrument'), { status: 409 });
    } else {
      raw = renderSyntheticMessage(instrument, scenario);
      this.lastSimulated.set(key, raw);
    }
    return this.ingest({ protocol, instrumentId: id, raw });
  }

  worklist(instrumentId, sampleId = null) {
    return getDemoWorklist(this.registry, instrumentId, sampleId);
  }

  stats() {
    return {
      total: this.records.length,
      pendingReview: this.records.filter(item => item.status === 'PENDING_REVIEW').length,
      unmatched: this.records.filter(item => item.status === 'UNMATCHED_ORDER').length,
      patientMismatch: this.records.filter(item => item.status === 'PATIENT_MISMATCH').length
    };
  }

  list() { return this.records; }
  find(id) { return this.records.find(item => item.id === id) || null; }
}

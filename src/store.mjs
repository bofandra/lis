import { createHash, randomUUID } from 'node:crypto';
import { instruments, orders, fixtures } from './fixtures.mjs';
import { parseAnalyzerMessage } from './parsers.mjs';

export class ResultStore {
  constructor() {
    this.records = [];
    this.fingerprints = new Map();
  }

  ingest({ protocol, instrumentId, raw }) {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('raw must be a non-empty string');
    if (Buffer.byteLength(raw, 'utf8') > 256 * 1024) throw new Error('Message exceeds 256 KiB');
    const instrument = instruments.find(item => item.id === instrumentId);
    if (!instrument) throw new Error('Unknown instrumentId');
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
      status: !order ? 'UNMATCHED_ORDER' : patientMismatch ? 'PATIENT_MISMATCH' : 'PENDING_REVIEW',
      // Raw data intentionally excluded from API and not persisted in this demo.
    };
    this.records.unshift(record);
    this.fingerprints.set(hash, record);
    if (this.records.length > 500) {
      const keep = new Set(this.records.slice(0, 500).map(item => item.id));
      this.records = this.records.slice(0, 500);
      for (const [key, value] of this.fingerprints) {
        if (!keep.has(value.id)) this.fingerprints.delete(key);
      }
    }
    return { duplicate: false, record };
  }

  simulate(protocol) {
    const fixture = fixtures[protocol];
    if (!fixture) throw new Error('Simulation supports only ASTM or HL7');
    return this.ingest({ protocol, ...fixture });
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

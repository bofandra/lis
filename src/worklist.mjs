import { orders } from './fixtures.mjs';

const byPanel = {
  'Kimia klinik': [{ code: 'GLU', display: 'Glucose' }, { code: 'CREA', display: 'Creatinine' }],
  'Darah lengkap': [{ code: 'HGB', display: 'Hemoglobin' }, { code: 'WBC', display: 'White blood cells' }]
};

export function getDemoWorklist(registry, instrumentId, sampleId = null) {
  const instrument = registry.get(instrumentId);
  if (!instrument) throw Object.assign(new Error('Instrument not found'), { status: 404 });
  if (!instrument.enabled) throw Object.assign(new Error('Instrument is disabled'), { status: 409 });
  if (!instrument.supportsOrderDownload)
    throw Object.assign(new Error('Order query is disabled for this instrument'), { status: 409 });

  const matchingPanel = instrument.protocol === 'ASTM' ? 'Kimia klinik' : 'Darah lengkap';
  const items = orders
    .filter(order => order.panel === matchingPanel && (!sampleId || order.sampleId === sampleId))
    .map(order => ({
      orderId: order.orderId,
      sampleId: order.sampleId,
      patientId: order.patientId,
      panel: order.panel,
      status: 'READY_FOR_ANALYZER_DEMO',
      testCodes: byPanel[order.panel]
    }));
  return { instrumentId, mode: 'SIMULATED_ORDER_QUERY', items };
}

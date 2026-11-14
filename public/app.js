const $ = id => document.getElementById(id);
let instruments = [];
let fixtures = {};
let records = [];

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function notify(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('toast').classList.remove('show'), 4000);
}

function elem(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = String(text);
  if (className) result.className = className;
  return result;
}

function statusText(status) {
  return ({ PENDING_REVIEW: 'Pending review', UNMATCHED_ORDER: 'Unmatched order', PATIENT_MISMATCH: 'Patient mismatch' })[status] || status;
}

function renderInstrumentCards() {
  $('instruments').replaceChildren();
  for (const instrument of instruments) {
    const card = elem('div', undefined, 'instrument');
    card.append(elem('div', instrument.protocol, 'instrument-icon'));
    const info = elem('div', undefined, 'info');
    info.append(elem('strong', instrument.name), elem('small', instrument.id + ' · ' + instrument.vendor + ' / ' + instrument.model + ' · ' + instrument.transport));
    card.append(info, elem('span', instrument.enabled ? '● CONFIGURED' : '○ DISABLED', 'pill'));
    $('instruments').append(card);
  }
}

function updateSelect() {
  const protocol = $('protocol').value;
  const options = instruments.filter(i => i.protocol === protocol).map(i => {
    const node = elem('option', i.name);
    node.value = i.id;
    return node;
  });
  $('instrument').replaceChildren(...options);
}

function loadFixture() {
  const fixture = fixtures[$('protocol').value];
  if (fixture) { $('instrument').value = fixture.instrumentId; $('raw').value = fixture.raw; }
}

function showDetails(record) {
  const panel = $('details');
  panel.hidden = false;
  panel.replaceChildren(elem('h3', 'Normalized result · ' + record.sampleId));
  const summary = elem('div', undefined, 'detail-grid');
  for (const [label, value] of [
    ['Order', record.matchedOrderId || 'NOT FOUND'],
    ['Patient (demo)', record.patientId || '-'],
    ['Status', statusText(record.status)],
    ['Message ID', record.messageId || '-']
  ]) {
    const item = elem('div', label + ': ');
    item.append(elem('span', value));
    summary.append(item);
  }
  panel.append(summary);
  const table = elem('table', undefined, 'obs');
  const head = elem('tr');
  for (const label of ['Code', 'Test', 'Result', 'Unit', 'Reference', 'Flag', 'LOINC demo']) head.append(elem('th', label));
  const thead = elem('thead'); thead.append(head); table.append(thead);
  const tbody = elem('tbody');
  for (const obs of record.observations) {
    const tr = elem('tr');
    for (const value of [obs.code, obs.display, obs.value, obs.unit, obs.referenceRange, obs.flag, obs.loincDemo || '-']) tr.append(elem('td', value));
    tbody.append(tr);
  }
  table.append(tbody);
  panel.append(table);
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderResults() {
  const tbody = $('results');
  tbody.replaceChildren();
  $('empty').hidden = records.length > 0;
  for (const record of records) {
    const row = elem('tr');
    const fields = [
      new Date(record.receivedAt).toLocaleTimeString('id-ID'),
      record.sampleId,
      record.instrumentName,
      record.protocol,
      record.observations.length + ' test(s)'
    ];
    fields.forEach((value, index) => {
      const cell = elem('td');
      if (index === 1) {
        cell.append(elem('strong', value), elem('div', record.matchedOrderId || 'No matching order'));
      } else cell.textContent = value;
      row.append(cell);
    });
    const status = elem('td');
    status.append(elem('span', statusText(record.status), 'status' + (record.status === 'UNMATCHED_ORDER' ? ' unmatched' : record.status === 'PATIENT_MISMATCH' ? ' mismatch' : '')));
    row.append(status);
    const action = elem('td');
    const button = elem('button', 'Detail', 'link');
    button.addEventListener('click', () => showDetails(record));
    action.append(button);
    row.append(action);
    tbody.append(row);
  }
}

async function refresh() {
  try {
    const data = await api('/api/results');
    records = data.items;
    $('total').textContent = data.stats.total;
    $('pending').textContent = data.stats.pendingReview;
    $('unmatched').textContent = data.stats.unmatched + data.stats.patientMismatch;
    renderResults();
  } catch (error) { notify(error.message); }
}

async function send(path, payload) {
  try {
    const data = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    notify(data.duplicate ? 'Duplikat terdeteksi; hasil tidak ditambahkan.' : 'Pesan diterima. Hasil perlu review petugas.');
    await refresh();
    if (data.record) showDetails(data.record);
  } catch (error) { notify('Gagal: ' + error.message); }
}

async function main() {
  try {
    const [deviceData, fixtureData] = await Promise.all([api('/api/instruments'), api('/api/fixtures')]);
    instruments = deviceData.items;
    fixtures = fixtureData;
    $('instrument-count').textContent = instruments.length;
    renderInstrumentCards(); updateSelect(); loadFixture();
    await refresh();
  } catch (error) { notify('Initialization failed: ' + error.message); }
  $('protocol').addEventListener('change', () => { updateSelect(); loadFixture(); });
  $('load-fixture').addEventListener('click', loadFixture);
  $('refresh').addEventListener('click', refresh);
  await initConfigAndSimulator();
  $('ingest-form').addEventListener('submit', event => {
    event.preventDefault();
    send('/api/ingest', { protocol: $('protocol').value, instrumentId: $('instrument').value, raw: $('raw').value });
  });
}

function updateSimSelect() {
  const prev = $('sim-instrument').value;
  $('sim-instrument').replaceChildren(...instruments.map(i => {
    const option = elem('option', i.name + (i.enabled ? '' : ' (disabled)'));
    option.value = i.id; return option;
  }));
  if (instruments.some(i => i.id === prev)) $('sim-instrument').value = prev;
}

function updateConfigSelect() {
  const prev = $('cfg-existing').value;
  const none = elem('option', '+ New instrument profile'); none.value = '';
  $('cfg-existing').replaceChildren(none, ...instruments.map(i => {
    const option = elem('option', i.name + ' (' + i.id + ')');
    option.value = i.id; return option;
  }));
  if (instruments.some(i => i.id === prev)) $('cfg-existing').value = prev;
}

function syncTransportFields() {
  const serial = $('cfg-transport').value === 'SERIAL_RS232';
  for (const element of document.querySelectorAll('.serial-field')) element.hidden = !serial;
  for (const element of document.querySelectorAll('.tcp-field')) element.hidden = serial;
}

function syncProtocolTransport() {
  if ($('cfg-transport').value === 'SERIAL_RS232') return;
  $('cfg-transport').value = $('cfg-protocol').value === 'ASTM' ? 'TCP_ASTM' : 'TCP_MLLP';
  $('cfg-port').value = $('cfg-protocol').value === 'ASTM' ? '5001' : '2575';
  syncTransportFields();
}

function resetConfigForm() {
  $('config-form').reset();
  $('cfg-existing').value = '';
  $('cfg-id').readOnly = false;
  $('cfg-protocol').value = 'ASTM';
  syncProtocolTransport();
}

function loadConfig() {
  const chosen = instruments.find(i => i.id === $('cfg-existing').value);
  if (!chosen) return resetConfigForm();
  $('cfg-id').value = chosen.id;
  $('cfg-id').readOnly = true;
  $('cfg-name').value = chosen.name;
  $('cfg-vendor').value = chosen.vendor;
  $('cfg-model').value = chosen.model;
  $('cfg-protocol').value = chosen.protocol;
  $('cfg-transport').value = chosen.transport;
  $('cfg-host').value = chosen.connection.host || '127.0.0.1';
  $('cfg-port').value = chosen.connection.port || (chosen.protocol === 'ASTM' ? 5001 : 2575);
  $('cfg-path').value = chosen.connection.path || '';
  $('cfg-baud').value = String(chosen.connection.baudRate || 9600);
  $('cfg-enabled').checked = chosen.enabled;
  $('cfg-bidir').checked = chosen.supportsOrderDownload;
  syncTransportFields();
}

async function reloadInstruments() {
  instruments = (await api('/api/instruments')).items;
  renderInstrumentCards();
  $('instrument-count').textContent = instruments.length;
  updateSelect(); updateSimSelect(); updateConfigSelect();
}

async function initConfigAndSimulator() {
  const data = await api('/api/simulator/scenarios');
  $('sim-scenario').replaceChildren(...data.items.map(item => {
    const option = elem('option', item.label);
    option.value = item.id; option.title = item.description;
    return option;
  }));
  updateSimSelect();
  updateConfigSelect();
  $('cfg-existing').addEventListener('change', loadConfig);
  $('cfg-reset').addEventListener('click', resetConfigForm);
  $('cfg-protocol').addEventListener('change', syncProtocolTransport);
  $('cfg-transport').addEventListener('change', syncTransportFields);
  $('simulate-selected').addEventListener('click', () => {
    const instrument = instruments.find(i => i.id === $('sim-instrument').value);
    if (!instrument) return notify('Pilih instrument terlebih dahulu.');
    send('/api/simulate', { protocol: instrument.protocol, instrumentId: instrument.id, scenario: $('sim-scenario').value });
  });
  $('query-worklist').addEventListener('click', async () => {
    try {
      const data = await api('/api/worklist?instrumentId=' + encodeURIComponent($('sim-instrument').value));
      $('worklist-output').hidden = false;
      $('worklist-output').textContent = JSON.stringify(data, null, 2);
      notify('Order query simulation completed.');
    } catch (error) { notify('Gagal query order: ' + error.message); }
  });
  $('config-form').addEventListener('submit', async event => {
    event.preventDefault();
    const selected = $('cfg-existing').value;
    const transport = $('cfg-transport').value;
    const payload = {
      id: $('cfg-id').value,
      name: $('cfg-name').value, vendor: $('cfg-vendor').value,
      model: $('cfg-model').value, protocol: $('cfg-protocol').value,
      transport,
      connection: transport === 'SERIAL_RS232'
        ? { path: $('cfg-path').value, baudRate: Number($('cfg-baud').value), dataBits: 8, stopBits: 1, parity: 'none' }
        : { host: $('cfg-host').value, port: Number($('cfg-port').value) },
      enabled: $('cfg-enabled').checked,
      supportsOrderDownload: $('cfg-bidir').checked
    };
    try {
      const path = selected ? '/api/instruments/' + encodeURIComponent(selected) : '/api/instruments';
      const method = selected ? 'PATCH' : 'POST';
      if (selected) delete payload.id;
      const saved = await api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await reloadInstruments();
      $('cfg-existing').value = saved.instrument.id;
      loadConfig();
      notify('Profile saved (metadata only; no hardware connected).');
    } catch (error) { notify('Gagal menyimpan: ' + error.message); }
  });
  resetConfigForm();
}

main();

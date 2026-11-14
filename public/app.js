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
    info.append(elem('strong', instrument.name), elem('small', instrument.id + ' · ' + instrument.transport));
    card.append(info, elem('span', '● READY', 'pill'));
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
  $('simulate-astm').addEventListener('click', () => send('/api/simulate', { protocol: 'ASTM' }));
  $('simulate-hl7').addEventListener('click', () => send('/api/simulate', { protocol: 'HL7' }));
  $('ingest-form').addEventListener('submit', event => {
    event.preventDefault();
    send('/api/ingest', { protocol: $('protocol').value, instrumentId: $('instrument').value, raw: $('raw').value });
  });
}
main();

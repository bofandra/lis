import net from 'node:net';

// Optional TCP listeners are OFF unless explicitly enabled. Bind loopback by
// default. Real analyzer integration needs vendor validation and authentication.
const ACK = '\x06';
const NAK = '\x15';
const ENQ = '\x05';
const EOT = '\x04';
const STX = '\x02';
const ETX = '\x03';
const ETB = '\x17';
const MLLP_START = '\x0b';
const MLLP_END = '\x1c\r';
const MAX = 256 * 1024;

function listen(server, port, host, name) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      console.log(name + ' listening at ' + host + ':' + port);
      resolve(server);
    });
  });
}

function hl7Ack(message, code) {
  const header = message.split('\r')[0].split('|');
  const id = header[9] || 'UNKNOWN';
  const sender = header[2] || 'ANALYZER';
  const facility = header[3] || 'LAB';
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return [
    'MSH|^~\\&|HOSNEX-LIS|LAB|' + sender + '|' + facility + '|' + timestamp + '||ACK|' + id + '-ACK|P|2.3.1',
    'MSA|' + code + '|' + id
  ].join('\r') + '\r';
}

export function createMllpServer(store, instrumentId = 'hema-hl7-01') {
  return net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (Buffer.byteLength(buffer, 'utf8') > MAX) return socket.destroy();
      while (true) {
        const start = buffer.indexOf(MLLP_START);
        if (start < 0) { buffer = ''; break; }
        if (start > 0) buffer = buffer.slice(start);
        const end = buffer.indexOf(MLLP_END, 1);
        if (end < 0) break;
        const message = buffer.slice(1, end);
        buffer = buffer.slice(end + MLLP_END.length);
        let code = 'AA';
        try { store.ingest({ protocol: 'HL7', instrumentId, raw: message }); }
        catch (error) { code = 'AE'; console.warn('Rejected HL7 message:', error.message); }
        socket.write(MLLP_START + hl7Ack(message, code) + MLLP_END);
      }
    });
  });
}

function checksum(payload) {
  let total = 0;
  for (let i = 0; i < payload.length; i++) total = (total + payload.charCodeAt(i)) & 0xff;
  return total.toString(16).toUpperCase().padStart(2, '0');
}

// Minimal ASTM E1381-like TCP receive-only session: ENQ/ACK, STX frame +
// sequence + ETB/ETX + two-hex checksum, ACK/NAK, EOT. Not a vendor driver.
export function createAstmServer(store, instrumentId = 'chem-astm-01') {
  return net.createServer(socket => {
    let buffer = '';
    let records = [];
    socket.on('data', chunk => {
      buffer += chunk.toString('latin1');
      if (buffer.length > MAX) return socket.destroy();
      while (buffer.length) {
        const first = buffer[0];
        if (first === ENQ) {
          records = [];
          buffer = buffer.slice(1);
          socket.write(ACK);
        } else if (first === EOT) {
          buffer = buffer.slice(1);
          const raw = records.join('');
          if (raw) {
            try { store.ingest({ protocol: 'ASTM', instrumentId, raw }); }
            catch (error) { console.warn('Rejected ASTM message:', error.message); }
          }
          records = [];
        } else if (first === STX) {
          const end = buffer.search(/[\x03\x17]/);
          if (end < 0 || buffer.length < end + 3) break;
          const frame = buffer.slice(1, end + 1); // sequence + record + terminator
          const claimed = buffer.slice(end + 1, end + 3).toUpperCase();
          const ok = /^[0-9A-F]{2}$/.test(claimed) && checksum(frame) === claimed;
          if (ok && frame.length > 1) records.push(frame.slice(1, -1));
          else records = [];
          socket.write(ok ? ACK : NAK);
          buffer = buffer.slice(end + 3).replace(/^\r?\n?/, '');
        } else if (first === '\r' || first === '\n') {
          buffer = buffer.slice(1);
        } else {
          // Discard unexpected leading bytes, never parse unframed network data.
          buffer = buffer.slice(1);
        }
      }
    });
  });
}

export async function startTransports(store) {
  const host = process.env.ANALYZER_HOST || '127.0.0.1';
  const started = [];
  if (process.env.ENABLE_HL7_MLLP === '1') {
    started.push(await listen(createMllpServer(store), Number(process.env.HL7_PORT || 2575), host, 'HL7 MLLP'));
  }
  if (process.env.ENABLE_ASTM_TCP === '1') {
    started.push(await listen(createAstmServer(store), Number(process.env.ASTM_PORT || 5001), host, 'ASTM TCP'));
  }
  return started;
}

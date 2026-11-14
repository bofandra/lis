import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { createMllpServer, createAstmServer } from '../src/transports.mjs';
import { ResultStore } from '../src/store.mjs';
import { astmFixture, hl7Fixture } from '../src/fixtures.mjs';

async function withServer(server, testFn) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await testFn(server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function frame(message) {
  const core = '1' + message + '\x03';
  const sum = [...core].reduce((value, char) => (value + char.charCodeAt(0)) & 255, 0)
    .toString(16).toUpperCase().padStart(2, '0');
  return '\x02' + core + sum + '\r\n';
}

test('HL7 MLLP listener receives ORU message and acknowledges AA', async () => {
  const store = new ResultStore();
  await withServer(createMllpServer(store), async port => {
    const socket = connect(port, '127.0.0.1');
    try {
      await once(socket, 'connect');
      socket.write('\x0b' + hl7Fixture + '\x1c\r');
      const [data] = await once(socket, 'data');
      assert.match(data.toString(), /MSA\|AA\|MSG-DEMO-0001/);
      assert.equal(store.list().length, 1);
    } finally { socket.destroy(); }
  });
});

test('ASTM TCP listener handles ENQ, checked frame and EOT', async () => {
  const store = new ResultStore();
  await withServer(createAstmServer(store), async port => {
    const socket = connect(port, '127.0.0.1');
    try {
      await once(socket, 'connect');
      socket.write('\x05');
      const [ack] = await once(socket, 'data');
      assert.equal(ack.toString(), '\x06');
      socket.write(frame(astmFixture) + '\x04');
      const [ack2] = await once(socket, 'data');
      assert.equal(ack2.toString(), '\x06');
      assert.equal(store.list().length, 1);
    } finally { socket.destroy(); }
  });
});

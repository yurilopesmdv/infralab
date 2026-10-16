// Execute dentro de um Pod da API. Consulta real de ponta a ponta, sem escrever tarefas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const request = (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
test('Loki responde pronto', async () => {
  assert.equal((await request('http://loki:3100/ready')).status, 200);
});

test('a mesma requisição aparece nos logs API e Nginx sem indexar request ID', async () => {
  const privateHeader = `Bearer logcheck-${randomUUID()}`;
  const response = await request('http://frontend:8080/api/tasks', { headers: { Authorization: privateHeader } });
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  const id = response.headers.get('x-request-id');
  assert.match(id, /^[a-f0-9-]{36}$/);
  const query = `{namespace="infralab",app=~"backend|frontend"} |= "${id}"`;
  let streams = [];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await request('http://loki:3100/loki/api/v1/query_range?' + new URLSearchParams({ query, since: '5m', limit: '100' }));
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.status, 'success');
    streams = body.data.result;
    if (['backend', 'frontend'].every(app => streams.some(stream => stream.stream.app === app))) break;
    await pause(2000);
  }
  for (const app of ['backend', 'frontend']) {
    const lines = streams.filter(stream => stream.stream.app === app).flatMap(stream => stream.values.map(value => value[1]));
    assert.ok(lines.some(line => JSON.parse(line).requestId === id), `Log ausente: ${app}`);
  }
  for (const stream of streams) {
    assert.ok(!('requestId' in stream.stream));
    assert.ok(stream.values.every(([, line]) => !line.includes(privateHeader)));
  }
  console.log(`requestId validado entre API e Nginx: ${id}`);
});

// Execute via stdin em um Pod da API; não requer credenciais administrativas.
import test from 'node:test';
import assert from 'node:assert/strict';

async function get(path) {
  const response = await fetch(`http://prometheus:9090${path}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'success');
  return body.data;
}
const query = expression => get(`/api/v1/query?${new URLSearchParams({ query: expression })}`);

test('Prometheus descobre réplicas da API sem duplicar targets', async () => {
  const { activeTargets } = await get('/api/v1/targets');
  const api = activeTargets.filter(target => target.labels.job === 'infralab-api');
  assert.ok(api.length > 0, 'Nenhum target da API');
  if (process.env.EXPECTED_API_REPLICAS !== undefined) {
    assert.equal(api.length, Number(process.env.EXPECTED_API_REPLICAS));
  }
  assert.equal(new Set(api.map(target => target.labels.pod)).size, api.length);
  assert.ok(api.every(target => target.health === 'up' && !target.lastError));
});

test('contador e histograma HTTP têm amostras coletadas', async () => {
  for (const metric of ['infralab_http_requests_total', 'infralab_http_request_duration_seconds_count']) {
    const data = await query(`sum(${metric}{job="infralab-api"})`);
    assert.ok(Number(data.result[0]?.value[1]) > 0, metric);
  }
});

test('regras locais carregadas e coleta saudável', async () => {
  const { groups } = await get('/api/v1/rules');
  const rules = groups.flatMap(group => group.rules);
  assert.ok(rules.some(rule => rule.name === 'InfraLabApiSemColeta' && rule.state === 'inactive'));
  assert.ok(rules.some(rule => rule.name === 'InfraLabApiErros5xx' && rule.health === 'ok'));
});

test('Grafana está pronto e seu banco responde', async () => {
  const response = await fetch('http://grafana:3000/api/health', { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).database, 'ok');
});

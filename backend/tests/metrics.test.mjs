import test from 'node:test';
import assert from 'node:assert/strict';
import { metrics, observeHttp } from '../dist/metrics.js';

test('métricas normalizam IDs e métodos e excluem probes/scrapes', async () => {
  observeHttp('PATCH', '/api/tasks/123', 200, 0.02);
  observeHttp('PATCH', '/api/tasks/987', 200, 0.03);
  observeHttp('CUSTOM-UNBOUNDED', '/arbitrary/user/path', 404, 0.01);
  observeHttp('GET', '/api/health/ready', 200, 0.001);
  observeHttp('GET', '/metrics', 200, 0.001);
  const records = await metrics.getMetricsAsJSON();
  const counter = records.find(item => item.name === 'infralab_http_requests_total');
  assert.equal(counter.values.length, 2);
  assert.equal(counter.values.find(v => v.labels.route === '/api/tasks/:id').value, 2);
  assert.equal(counter.values.find(v => v.labels.route === 'unmatched').labels.method, 'OTHER');
  const histogram = records.find(item => item.name === 'infralab_http_request_duration_seconds');
  const sum = histogram.values.find(v => v.metricName.endsWith('_sum') && v.labels.route === '/api/tasks/:id');
  assert.equal(sum.value, 0.05);
  const text = await metrics.metrics();
  assert.ok(!text.includes('/api/tasks/123'));
  assert.ok(!text.includes('/api/tasks/987'));
  assert.ok(!text.includes('CUSTOM-UNBOUNDED'));
});

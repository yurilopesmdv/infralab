import { collectDefaultMetrics, Counter, Histogram, Registry } from '@prometheus-io/client';

export const metrics = new Registry();
collectDefaultMetrics({ register: metrics });
const labels = ['method', 'route', 'status_code'] as const;
const requests = new Counter({
  name: 'infralab_http_requests_total',
  help: 'Completed HTTP responses, excluding health and metrics endpoints.',
  labelNames: labels,
  registers: [metrics]
});
const duration = new Histogram({
  name: 'infralab_http_request_duration_seconds',
  help: 'HTTP response duration in seconds.',
  labelNames: labels,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metrics]
});

export function observeHttp(method: string, path: string, status: number, seconds: number) {
  if (path === '/metrics' || /^\/api\/health(?:\/|$)/.test(path)) return;
  const route = path === '/api/tasks' ? '/api/tasks'
    : /^\/api\/tasks\/[1-9]\d*$/.test(path) ? '/api/tasks/:id' : 'unmatched';
  const safeMethod = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER';
  const values = { method: safeMethod, route, status_code: String(status) };
  requests.inc(values);
  duration.observe(values, seconds);
}

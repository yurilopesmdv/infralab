// Leituras limitadas: executar com Node dentro de um Pod, sem dependências extras.
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
const target = process.env.TARGET_URL ?? 'http://frontend:8080/api/tasks';
const duration = Number(process.env.DURATION_SECONDS ?? 20);
const concurrency = Number(process.env.CONCURRENCY ?? 8);
const rate = Number(process.env.REQUESTS_PER_SECOND ?? 0);
if (!Number.isInteger(duration) || duration < 1 || duration > 300 ||
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64 ||
    !Number.isInteger(rate) || rate < 0 || rate > 5000) {
  throw new Error('Duração: 1–300 s; concorrência: 1–64; taxa: 0–5000/s (0: sem limite de taxa).');
}
const start = performance.now();
const deadline = start + duration * 1000;
let total = 0;
let errors = 0;
const failures = {};
const fail = (reason) => {
  errors++;
  failures[reason] = (failures[reason] ?? 0) + 1;
};
const histogram = new Uint32Array(5001);
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (performance.now() < deadline) {
    const before = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        await response.arrayBuffer();
        fail(`http_${response.status}`);
      } else {
        const body = await response.json();
        if (!Array.isArray(body)) fail('invalid_response');
      }
    } catch (error) {
      fail(String(error.cause?.code ?? error.name ?? 'transport_error'));
    }
    total++;
    histogram[Math.min(5000, Math.ceil(performance.now() - before))]++;
    if (rate) {
      const wait = Math.min(deadline - performance.now(), concurrency * 1000 / rate - (performance.now() - before));
      if (wait > 0) await pause(Math.ceil(wait));
    }
  }
}));
function percentile(fraction) {
  let count = 0;
  for (let ms = 0; ms < histogram.length; ms++) {
    count += histogram[ms];
    if (count >= Math.ceil(total * fraction)) return ms;
  }
  return 5000;
}
console.log(JSON.stringify({ target, concurrency, requestedRatePerSecond: rate, total, errors, failures,
  seconds: +( (performance.now() - start) / 1000).toFixed(2),
  requestsPerSecond: +(total / ((performance.now() - start) / 1000)).toFixed(2),
  p50ms: percentile(0.50), p95ms: percentile(0.95), p99ms: percentile(0.99),
  latencyBucketCapMs: 5000 }));
if (errors || !total) process.exitCode = 1;

import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL ?? 'http://localhost:8080';
const request = (path, options) => fetch(`${base}${path}`, {
  ...options, signal: AbortSignal.timeout(10_000)
});
const json = (method, body) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('frontend entrega HTML e JavaScript', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<div id="root">/);
  const asset = html.match(/src="([^"]+\.js)"/);
  assert.ok(asset, 'Bundle JavaScript ausente');
  const bundle = await request(asset[1]);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('content-type'), /javascript/);
});

test('liveness e readiness respondem com request ID', async () => {
  for (const path of ['/api/health', '/api/health/live', '/api/health/ready']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  }
});

test('CRUD mantém conteúdo Unicode e valida entradas', async () => {
  let id;
  try {
    for (const title of ['', ' ', 'x'.repeat(201), 123]) {
      assert.equal((await request('/api/tasks', json('POST', { title }))).status, 400);
    }
    assert.equal((await request('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    })).status, 400);
    const title = 'Teste InfraLab: ação e persistência 🚀';
    const created = await request('/api/tasks', json('POST', { title }));
    assert.equal(created.status, 201);
    const task = await created.json();
    id = task.id;
    assert.equal(task.title, title);
    assert.equal(task.done, 0);
    const list = await (await request('/api/tasks')).json();
    assert.ok(list.some(item => item.id === id && item.title === title));
    assert.equal((await request(`/api/tasks/${id}`, json('PATCH', { done: 'true' }))).status, 400);
    const updated = await request(`/api/tasks/${id}`, json('PATCH', { done: true }));
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).done, 1);
    assert.equal((await request(`/api/tasks/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await request(`/api/tasks/${id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await request('/api/not-found')).status, 404);
  } finally {
    if (id !== undefined) await request(`/api/tasks/${id}`, { method: 'DELETE' });
  }
});

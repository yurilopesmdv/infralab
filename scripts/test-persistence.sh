#!/usr/bin/env bash
# Execute na raiz do projeto. Recria apenas o backend, preservando seu volume.
set -euo pipefail

task_id=$(docker compose exec -T backend node --input-type=module <<'JS'
const response = await fetch('http://127.0.0.1:3000/api/tasks', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Teste temporário de persistência' })
});
if (response.status !== 201) throw new Error('Falha ao criar tarefa');
console.log((await response.json()).id);
JS
)

docker compose up -d --force-recreate --wait backend

docker compose exec -T -e TEST_TASK_ID="$task_id" backend node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const id = Number(process.env.TEST_TASK_ID);
const base = 'http://127.0.0.1:3000/api/tasks';
try {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).some(task => task.id === id), 'Tarefa não persistiu');
  console.log('OK: tarefa persistiu após recriar o container do backend.');
} finally {
  const response = await fetch(`${base}/${id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
}
JS

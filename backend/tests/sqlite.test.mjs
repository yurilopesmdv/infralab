import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../dist/store.js';

test('SQLite continua funcionando e persiste após fechar e reabrir o banco', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'infralab-sqlite-'));
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_PATH = join(dir, 'tasks.db');
  let store;
  try {
    store = await createStore();
    await store.ready();
    assert.equal(store.database, 'sqlite');
    const task = await store.create('Compatibilidade SQLite 🚀');
    assert.equal((await store.update(task.id, true)).done, 1);
    await store.close();
    store = undefined;
    store = await createStore();
    assert.deepEqual((await store.list()).map(row => ({ ...row })), [{ ...task, done: 1 }]);
    assert.equal(await store.remove(task.id), true);
    assert.equal(await store.remove(task.id), false);
    assert.equal(await store.update(task.id, false), undefined);
  } finally {
    if (store) await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

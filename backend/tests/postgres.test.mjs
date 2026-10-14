import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
import { migrateSqlite } from '../dist/migrate-sqlite.js';
import { tasksSchema } from '../dist/postgres.js';

const enabled = process.env.PG_TESTS === '1';

test('migração PostgreSQL preserva dados, controla repetição e reverte falhas', { skip: !enabled }, async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const admin = new pg.Pool();
  try { await admin.query('CREATE DATABASE migration_test'); }
  finally { await admin.end(); }
  const pool = new pg.Pool({ database: 'migration_test' });
  const dir = mkdtempSync(join(tmpdir(), 'infralab-migration-'));
  let number = 0;
  function fixture(rows) {
    const path = join(dir, `${number++}.db`);
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL)');
    for (const row of rows) db.prepare('INSERT INTO tasks VALUES (?, ?, ?)').run(row.id, row.title, row.done);
    db.close();
    return path;
  }
  async function reset() { await pool.query('DROP TABLE IF EXISTS tasks, infralab_migrations'); }
  try {
    await t.test('cópia, sequência de IDs, repetição e origem somente leitura', async () => {
      const rows = [{ id: 7, title: 'ação 🚀', done: 1 }, { id: 42, title: "SQL ' preservado", done: 0 }];
      const path = fixture(rows);
      const original = readFileSync(path);
      assert.deepEqual(await migrateSqlite(path, pool), { status: 'migrated', tasks: 2 });
      assert.deepEqual((await pool.query('SELECT id, title, done FROM tasks ORDER BY id')).rows, rows);
      assert.equal((await pool.query("INSERT INTO tasks (title) VALUES ('nova') RETURNING id")).rows[0].id, 43);
      await pool.query("UPDATE tasks SET title = 'editada no PostgreSQL' WHERE id = 7");
      assert.equal((await migrateSqlite(path, pool)).status, 'already-migrated');
      assert.equal((await pool.query('SELECT title FROM tasks WHERE id = 7')).rows[0].title, 'editada no PostgreSQL');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 3);
      assert.deepEqual(readFileSync(path), original);
      const changed = fixture([...rows, { id: 99, title: 'mudança na origem', done: 0 }]);
      await assert.rejects(migrateSqlite(changed, pool), /Origem mudou/);
    });
    await t.test('destino preenchido não é sobrescrito', async () => {
      await reset();
      await pool.query(tasksSchema);
      await pool.query("INSERT INTO tasks (title) VALUES ('já existente')");
      await assert.rejects(migrateSqlite(fixture([{ id: 1, title: 'origem', done: 0 }]), pool), /já contém dados/);
      assert.equal((await pool.query('SELECT title FROM tasks')).rows[0].title, 'já existente');
    });
    await t.test('falha no meio da cópia reverte todas as inserções', async () => {
      await reset();
      await pool.query(tasksSchema);
      await pool.query("ALTER TABLE tasks ADD CONSTRAINT test_title CHECK (title <> 'rejeitar')");
      const path = fixture([{ id: 1, title: 'primeira', done: 0 }, { id: 2, title: 'rejeitar', done: 0 }]);
      await assert.rejects(migrateSqlite(path, pool));
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 0);
    });
    await t.test('origem vazia permite primeiro ID 1 e migrações concorrentes não duplicam', async () => {
      await reset();
      const path = fixture([]);
      const results = await Promise.all([migrateSqlite(path, pool), migrateSqlite(path, pool)]);
      assert.deepEqual(results.map(r => r.status).sort(), ['already-migrated', 'migrated']);
      assert.equal((await pool.query("INSERT INTO tasks (title) VALUES ('primeira') RETURNING id")).rows[0].id, 1);
    });
    await t.test('arquivo ausente e tarefa inválida não criam nem alteram o destino', async () => {
      const absent = join(dir, 'ausente.db');
      await assert.rejects(migrateSqlite(absent, pool));
      assert.equal(existsSync(absent), false);
      await assert.rejects(migrateSqlite(fixture([{ id: 1, title: 'inválida', done: 2 }]), pool), /incompatível/);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 1);
    });
  } finally {
    await pool.end();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PostgreSQL indisponível gera readiness 503 sem derrubar liveness', { skip: !enabled }, async () => {
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, DB_DRIVER: 'postgres', PGHOST: '127.0.0.1', PGPORT: '1', PORT: '3002' },
    stdio: 'ignore'
  });
  const exit = once(child, 'exit');
  const request = path => fetch(`http://127.0.0.1:3002${path}`, { signal: AbortSignal.timeout(3_000) });
  try {
    let live;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { live = await request('/api/health/live'); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.equal(live?.status, 200);
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await request('/api/health/ready')).status, 503);
      assert.equal((await request('/api/health/live')).status, 200);
    }
  } finally {
    child.kill('SIGTERM');
    await exit;
  }
});

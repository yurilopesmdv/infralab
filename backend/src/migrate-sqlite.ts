import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createPool, tasksSchema } from './postgres.js';
import type { Task } from './store.js';

const migrationName = 'sqlite-tasks-v1';
export class MigrationError extends Error {}

export async function migrateSqlite(path: string, pool: Pool) {
  const { DatabaseSync } = await import('node:sqlite');
  // readOnly impede criar um banco inexistente ou modificar a origem.
  const source = new DatabaseSync(path, { readOnly: true });
  let tasks: Task[];
  try {
    tasks = source.prepare('SELECT id, title, done FROM tasks ORDER BY id').all() as Task[];
    for (const task of tasks) {
      if (!Number.isInteger(task.id) || task.id < 1 || task.id > 2_147_483_647 ||
          typeof task.title !== 'string' || ![0, 1].includes(task.done)) {
        throw new MigrationError('Origem contém uma tarefa incompatível. Migração cancelada.');
      }
    }
  } finally { source.close(); }
  const hash = createHash('sha256').update(JSON.stringify(tasks)).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(730001)');
    await client.query(tasksSchema);
    await client.query(`CREATE TABLE IF NOT EXISTS infralab_migrations (
      name TEXT PRIMARY KEY, source_hash TEXT NOT NULL, task_count INTEGER NOT NULL
    )`);
    const previous = await client.query('SELECT source_hash, task_count FROM infralab_migrations WHERE name = $1', [migrationName]);
    if (previous.rowCount) {
      if (previous.rows[0].source_hash !== hash) throw new MigrationError('Origem mudou após a migração anterior. Não sobrescrevemos o destino.');
      await client.query('COMMIT');
      return { status: 'already-migrated', tasks: previous.rows[0].task_count };
    }
    // Impede escritores simultâneos no destino durante a cópia.
    await client.query('LOCK TABLE tasks IN ACCESS EXCLUSIVE MODE');
    if ((await client.query('SELECT 1 FROM tasks LIMIT 1')).rowCount) {
      throw new MigrationError('Tabela tasks de destino já contém dados. Migração cancelada.');
    }
    for (const task of tasks) {
      await client.query('INSERT INTO tasks (id, title, done) VALUES ($1, $2, $3)', [task.id, task.title, task.done]);
    }
    const imported = (await client.query<Task>('SELECT id, title, done FROM tasks ORDER BY id')).rows;
    if (JSON.stringify(imported) !== JSON.stringify(tasks)) throw new MigrationError('Verificação da cópia falhou.');
    await client.query(`SELECT setval(pg_get_serial_sequence('tasks', 'id'),
      COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM tasks`);
    await client.query('INSERT INTO infralab_migrations (name, source_hash, task_count) VALUES ($1, $2, $3)', [migrationName, hash, tasks.length]);
    await client.query('COMMIT');
    return { status: 'migrated', tasks: tasks.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    const result = await migrateSqlite(process.env.SQLITE_PATH ?? '/source/tasks.db', pool);
    console.log(JSON.stringify({ level: 'info', ...result }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: error instanceof MigrationError ? error.message : 'Migração falhou; verifique origem e conexão PostgreSQL.' }));
    process.exitCode = 1;
  } finally { await pool.end(); }
}

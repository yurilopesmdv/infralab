import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createPool, tasksSchema } from './postgres.js';

export type Task = { id: number; title: string; done: number };
export type TaskStore = {
  database: 'sqlite' | 'postgres';
  ready(): Promise<void>;
  list(): Promise<Task[]>;
  create(title: string): Promise<Task>;
  update(id: number, done: boolean): Promise<Task | undefined>;
  remove(id: number): Promise<boolean>;
  close(): Promise<void>;
};

export async function createStore(): Promise<TaskStore> {
  const driver = process.env.DB_DRIVER ?? 'sqlite';
  if (driver === 'sqlite') {
    const { DatabaseSync } = await import('node:sqlite');
    const path = process.env.DATABASE_PATH ?? './data/tasks.db';
    mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY, title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
      ) STRICT;`);
    return {
      database: 'sqlite',
      async ready() { db.prepare('SELECT 1').get(); },
      async list() { return db.prepare('SELECT id, title, done FROM tasks ORDER BY id DESC').all() as Task[]; },
      async create(title) {
        const result = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(title);
        return db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(result.lastInsertRowid) as Task;
      },
      async update(id, done) {
        const result = db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(Number(done), id);
        return result.changes ? db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id) as Task : undefined;
      },
      async remove(id) { return Boolean(db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes); },
      async close() { db.close(); }
    };
  }
  if (driver !== 'postgres') throw new Error('DB_DRIVER deve ser sqlite ou postgres.');
  const pool = createPool();
  let initialized: Promise<unknown> | undefined;
  async function initialize() {
    initialized ??= pool.query(tasksSchema).catch(error => { initialized = undefined; throw error; });
    await initialized;
  }
  return {
    database: 'postgres',
    async ready() { await initialize(); await pool.query('SELECT 1'); },
    async list() {
      await initialize();
      return (await pool.query<Task>('SELECT id, title, done FROM tasks ORDER BY id DESC')).rows;
    },
    async create(title) {
      await initialize();
      return (await pool.query<Task>('INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done', [title])).rows[0];
    },
    async update(id, done) {
      await initialize();
      return (await pool.query<Task>('UPDATE tasks SET done = $1 WHERE id = $2 RETURNING id, title, done', [Number(done), id])).rows[0];
    },
    async remove(id) {
      await initialize();
      return Boolean((await pool.query('DELETE FROM tasks WHERE id = $1', [id])).rowCount);
    },
    async close() { await pool.end(); }
  };
}

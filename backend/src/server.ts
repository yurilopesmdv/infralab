import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.DATABASE_PATH ?? './data/tasks.db';
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
  ) STRICT;`);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new HttpError(415, 'Envie Content-Type: application/json.');
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) throw new HttpError(413, 'Corpo da requisição muito grande.');
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new HttpError(400, 'JSON inválido.'); }
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const started = performance.now();
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info', requestId, method: req.method, path,
    status: res.statusCode, durationMs: Math.round(performance.now() - started)
  })));
  try {
    if (req.method === 'GET' && path === '/api/health/live') {
      return reply(res, 200, { status: 'ok' });
    }
    if (req.method === 'GET' && (path === '/api/health' || path === '/api/health/ready')) {
      try { db.prepare('SELECT 1').get(); }
      catch { return reply(res, 503, { status: 'unavailable', database: 'sqlite' }); }
      return reply(res, 200, { status: 'ok', database: 'sqlite' });
    }
    if (req.method === 'GET' && path === '/api/tasks') {
      return reply(res, 200, db.prepare('SELECT * FROM tasks ORDER BY id DESC').all());
    }
    if (req.method === 'POST' && path === '/api/tasks') {
      const { title } = await readBody(req);
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        throw new HttpError(400, 'Título deve ter entre 1 e 200 caracteres.');
      }
      const result = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(title.trim());
      return reply(res, 201, db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
    }
    const match = path.match(/^\/api\/tasks\/([1-9]\d*)$/);
    if (match && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id)) throw new HttpError(400, 'ID inválido.');
      if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(id)) {
        throw new HttpError(404, 'Tarefa não encontrada.');
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        res.writeHead(204).end();
        return;
      }
      const { done } = await readBody(req);
      if (typeof done !== 'boolean') throw new HttpError(400, 'done deve ser booleano.');
      db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(Number(done), id);
      return reply(res, 200, db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    }
    throw new HttpError(404, 'Rota não encontrada.');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(JSON.stringify({ level: 'error', requestId, message: String(error) }));
    if (!res.destroyed) reply(res, status, { error: status === 500 ? 'Erro interno.' : (error as Error).message });
  }
});
server.requestTimeout = 10_000;
server.listen(3000, '0.0.0.0', () => console.log(JSON.stringify({ level: 'info', message: 'API iniciada', port: 3000 })));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}

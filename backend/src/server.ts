import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createStore } from './store.js';

const store = await createStore();

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
      try { await store.ready(); }
      catch { return reply(res, 503, { status: 'unavailable', database: store.database }); }
      return reply(res, 200, { status: 'ok', database: store.database });
    }
    if (req.method === 'GET' && path === '/api/tasks') {
      return reply(res, 200, await store.list());
    }
    if (req.method === 'POST' && path === '/api/tasks') {
      const { title } = await readBody(req);
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        throw new HttpError(400, 'Título deve ter entre 1 e 200 caracteres.');
      }
      return reply(res, 201, await store.create(title.trim()));
    }
    const match = path.match(/^\/api\/tasks\/([1-9]\d*)$/);
    if (match && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || (store.database === 'postgres' && id > 2_147_483_647)) throw new HttpError(400, 'ID inválido.');
      if (req.method === 'DELETE') {
        if (!await store.remove(id)) throw new HttpError(404, 'Tarefa não encontrada.');
        res.writeHead(204).end();
        return;
      }
      const { done } = await readBody(req);
      if (typeof done !== 'boolean') throw new HttpError(400, 'done deve ser booleano.');
      const task = await store.update(id, done);
      if (!task) throw new HttpError(404, 'Tarefa não encontrada.');
      return reply(res, 200, task);
    }
    throw new HttpError(404, 'Rota não encontrada.');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(JSON.stringify({ level: 'error', requestId, message: 'Falha na operação de banco' }));
    if (!res.destroyed) reply(res, status, { error: status === 500 ? 'Erro interno.' : (error as Error).message });
  }
});
server.requestTimeout = 10_000;
const port = Number(process.env.PORT ?? 3000);
server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ level: 'info', message: 'API iniciada', port, database: store.database })));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { void store.close().then(() => process.exit(0)); }));
}

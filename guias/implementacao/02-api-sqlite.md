# 02 — API e SQLite

## O que aprender e por quê

A API recebe HTTP e executa operações de banco. SQLite é uma biblioteca que grava um arquivo; não precisamos de um container de banco nesta fase. O contrato JSON permite trocar a implementação do banco sem mudar React.

## Arquivos e conexões

- `backend/src/server.ts`: servidor HTTP, validação e request ID.
- `backend/src/store.ts`: consultas SQLite/PostgreSQL.
- `backend/src/postgres.ts`: pool e schema PostgreSQL, usados no capítulo 07.

Exemplo do contrato de escrita:

```json
{"title":"Aprender Kubernetes"}
```

Resposta: `{"id":1,"title":"Aprender Kubernetes","done":0}`. `POST /api/tasks` cria, `GET /api/tasks` lista, `PATCH /api/tasks/:id` modifica o estado e `DELETE /api/tasks/:id` exclui uma tarefa escolhida.

Consultas parametrizadas separam valores de instruções SQL. No PostgreSQL, por exemplo, `WHERE id = $1` recebe o ID como parâmetro. O código não concatena entradas do usuário em SQL.

Trecho real da rota em `server.ts`, dentro do handler HTTP:

```typescript
if (req.method === 'GET' && path === '/api/tasks') {
  return reply(res, 200, await store.list());
}
```

O `await` aguarda a consulta antes de responder; `store` mantém a seleção de banco fora da rota. `reply` serializa o resultado com Content-Type JSON. Essa separação pequena permite trocar SQLite por PostgreSQL sem introduzir um framework.

## Execução e validação

A aplicação será iniciada pelo Compose no capítulo 04. Depois:

```bash
curl --fail -sS http://localhost:8080/api/health/live
curl --fail -sS http://localhost:8080/api/health/ready
curl --fail -sS http://localhost:8080/api/tasks
```

Liveness testa o processo HTTP; readiness consulta o banco. Banco indisponível produz readiness 503, sem exigir reinício do processo saudável.

## Aprendizado

Uma réplica com arquivo SQLite é suficiente para a primeira aula. Escalar APIs escritoras sobre SQLite compartilhado não é nosso caminho para produção; migraremos para PostgreSQL.

Pergunta: por que uma falha do banco deve afetar readiness, mas não necessariamente liveness?

Anterior: [01](01-ambiente.md). Próximo: [03 — Frontend e Nginx](03-frontend-nginx.md).

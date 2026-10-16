# Backend — API e acesso aos dados

API HTTP nativa do Node.js, escrita em TypeScript e compilada para JavaScript. O objetivo é manter o fluxo requisição → validação → consulta → resposta simples de acompanhar.

| Arquivo | Responsabilidade |
|---|---|
| [src/server.ts](src/server.ts) | Rotas, validação JSON, request ID, logs e encerramento controlado |
| [src/store.ts](src/store.ts) | Seleção de SQLite/PostgreSQL e operações de tarefas |
| [src/metrics.ts](src/metrics.ts) | Registro, métricas HTTP e normalização de labels |
| [tests/metrics.test.mjs](tests/metrics.test.mjs) | Cardinalidade, exclusão de probes/scrapes e observação do histograma |
| [src/postgres.ts](src/postgres.ts) | Schema e pool PostgreSQL, limitado a cinco conexões por processo |
| [src/migrate-sqlite.ts](src/migrate-sqlite.ts) | Snapshot SQLite/WAL e migração transacional preservando IDs |
| [Dockerfile](Dockerfile) | Etapas build, runtime e test, com usuário node |
| [tests/app.test.mjs](tests/app.test.mjs) | Frontend HTTP, probes, CRUD, entradas inválidas e request ID |
| [tests/postgres.test.mjs](tests/postgres.test.mjs) | PostgreSQL, migração, rollback e disponibilidade |
| [tests/sqlite.test.mjs](tests/sqlite.test.mjs) | Compatibilidade da execução SQLite |

## Contrato e conexão

`GET /api/tasks` lista; `POST /api/tasks` recebe `{"title":"..."}`; `PATCH /api/tasks/:id` altera conclusão; `DELETE /api/tasks/:id` remove a tarefa escolhida. A resposta mantém `id`, `title` e `done` em 0/1. Consulte o código e os testes para validação exata de cada entrada.

`DB_DRIVER` seleciona banco; por padrão é SQLite. `DATABASE_PATH` define o arquivo. Com PostgreSQL, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` e `PGPASSWORD` configuram o cliente. No Kubernetes, as credenciais vêm do Secret; não grave senha no repositório.

Liveness verifica o processo HTTP. Readiness verifica o banco selecionado, retornando 503 se indisponível. Logs incluem request ID, método, caminho, status e duração. SIGTERM encerra o servidor e depois o pool. Essas interfaces permanecem separadas de `/metrics`, que exporta métricas HTTP e de processo via `@prometheus-io/client`.

## Executar e validar

Na raiz do repositório:

```bash
docker compose up --build -d --wait
docker compose --profile test run --build --rm test
bash scripts/test-postgres.sh
```

O primeiro teste usa o ambiente Compose da aplicação e limpa sua própria tarefa de teste. O script PostgreSQL usa ambiente isolado, sem portas publicadas, e remove somente seus recursos temporários ao terminar. Testes usam o runner nativo do Node.js.

Comece pelo [capítulo da API](../guias/implementacao/02-api-sqlite.md). Para evolução do banco, consulte [migração](../docs/POSTGRESQL.md). Voltar ao [projeto](../README.md).

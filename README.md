# InfraLab

Laboratório para aprender Docker, Kubernetes e operação de aplicações com uma lista de tarefas simples em React, Node.js, TypeScript e banco de dados.

## Etapa atual: aplicação via Docker Compose

- React: adicionar, listar, concluir e excluir tarefas.
- API HTTP nativa do Node.js/TypeScript, sem framework ou ORM.
- SQLite com consultas parametrizadas e volume persistente.
- Dockerfiles multi-stage, processos sem root, `.dockerignore` e health checks.
- Rede interna, limites de CPU/memória e apenas uma porta publicada no host.
- Logs JSON com método, rota, status e duração; a API inclui request ID.

## Arquitetura

```text
Navegador → localhost:8080 → frontend (Nginx + React compilado)
                              └─ /api/* → backend:3000 (Node.js)
                                            └─ /app/data/tasks.db
                                                  volume sqlite-data
```

São dois containers. SQLite grava um arquivo e não precisa de um servidor separado. Somente o backend acessa o banco. O navegador usa `/api`; Nginx resolve `backend` pela rede interna do Compose. A API não publica uma porta no host.

## Requisitos e execução

Ubuntu no WSL 2, Docker Desktop em execução e integrado à distribuição, Compose v2 e Git. Node/npm no host não são necessários para executar a aplicação. Para diagnóstico: `bash scripts/check-environment.sh`. Veja [o guia do ambiente](docs/SETUP-VSCODE.md).

Na raiz do projeto, pelo terminal Ubuntu:

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

`config --quiet` valida a configuração. `--build` constrói as imagens, `-d` executa em segundo plano e `--wait` aguarda os health checks. `ps` mostra estado, saúde e portas.

Abra **http://localhost:8080**. Adicione uma tarefa, marque como concluída e exclua uma tarefa de teste. Ambos os serviços devem aparecer como `healthy`.

## Validação e investigação

```bash
curl --fail http://localhost:8080/api/health
curl --fail http://localhost:8080/api/tasks
docker compose logs --tail=20 backend frontend
docker stats --no-stream
docker compose exec backend id
docker compose exec frontend id
```

O health check retorna `{"status":"ok","database":"sqlite"}` e verifica uma consulta ao banco. A listagem retorna um array JSON. A API retorna `X-Request-Id` para correlação com seus logs. `stats` mostra consumo; `id` deve indicar um usuário diferente de root.

Teste HTTP automatizado com o test runner nativo do Node.js, dentro do Docker:

```bash
docker compose --profile test run --build --rm test
```

Verifica frontend estático, saúde, CRUD, validação de entradas e request ID. Cria e exclui apenas sua própria tarefa temporária. A interação visual deve ser validada também no navegador.

O perfil `test` adiciona um container temporário somente para validação. Ele não inicia com o `up` normal e não monta o volume do banco. `--rm` remove o container de testes ao terminar.

Para testar também a persistência automaticamente: `bash scripts/test-persistence.sh`. Execute na raiz do projeto; o script usa Node dentro do Docker, recria o backend preservando o volume e verifica a tarefa antes de excluí-la. Não requer Python, npm ou Node no host.

### Persistência

Adicione uma tarefa pelo navegador e execute:

```bash
docker compose up -d --force-recreate --wait backend
```

O container é substituído, mas o volume permanece. Recarregue a página: a tarefa deve continuar lá. Persistência não substitui backup.

### Parar e retomar

```bash
docker compose stop
docker compose up -d --wait
```

`stop` encerra os processos, preservando containers e dados. `docker compose down` remove os containers e a rede, preservando o volume nomeado. **Não use `down -v` sem decidir apagar o banco:** `-v` remove os volumes do projeto.

## Organização e conceitos de Docker

| Arquivo | Responsabilidade |
|---|---|
| `compose.yaml` | Serviços, volume, portas e recursos |
| `backend/src/server.ts` | API, SQLite, validação e logs |
| `backend/Dockerfile` | Compila TypeScript e executa JavaScript |
| `frontend/src/main.tsx` | Interface React e chamadas HTTP |
| `frontend/nginx.conf` | Arquivos estáticos e proxy para a API |
| `frontend/Dockerfile` | Compila React e entrega o resultado com Nginx |
| `backend/tests/app.test.mjs` | Testes HTTP com Node.js nativo |
| `scripts/test-persistence.sh` | Verifica persistência após recriar o backend |

**Imagem** é o pacote usado para criar um container. **Container** é uma instância executável desse pacote. **Volume** mantém dados fora do ciclo de vida do container. **Rede** permite comunicação entre serviços por nome.

Os Dockerfiles copiam as dependências antes do código: alterações no código podem reutilizar a camada de `npm ci`. Os lockfiles fixam a resolução das dependências. As imagens base usam versões explícitas; atualizações de segurança devem ser feitas e testadas deliberadamente. As imagens finais não incluem compiladores nem dependências de desenvolvimento.

## Backend no Kubernetes local

O backend já foi implantado no cluster kind `infralab`, com uma réplica, Deployment `Recreate`, PVC `sqlite-data`, Service interno, probes e limites de recursos. Os manifests estão em `k8s/`. A saúde da API e a criação de tarefas foram validadas; a tarefa permaneceu após substituir o Pod.

```bash
kubectl --context kind-infralab get pods,pvc,services -n infralab
kubectl --context kind-infralab port-forward -n infralab service/backend 3001:3000
```

No segundo terminal: `curl --fail -sS http://localhost:3001/api/health/ready`. O encaminhamento permanece aberto até `Ctrl+C`.

O banco Kubernetes é separado do Compose. O armazenamento local do kind não garante persistência após excluir o cluster. Frontend Kubernetes e observabilidade ainda estão pendentes. Consulte [o guia Kubernetes](docs/KUBERNETES.md).

## Evolução e limites

Este laboratório publica HTTP somente em `127.0.0.1`, não tem autenticação e usa uma única instância da API. O SQLite síncrono mantém o exemplo pequeno. Não é uma configuração pronta para exposição pública.

Etapas futuras, ainda não implementadas:

1. **Completar Kubernetes com kind:** frontend e ConfigMap Nginx; backend, Service, PVC e probes já estão implementados.
2. **PostgreSQL:** migrar antes de escalar escrita para múltiplas réplicas. Não compartilhar SQLite entre vários Pods como solução de escalabilidade.
3. **Escalabilidade:** réplicas, HPA e testes de carga após a migração.
4. **Monitoramento:** métricas HTTP, latência e taxa de erros via Prometheus; dashboards e alertas no Grafana.
5. **Observabilidade:** centralizar logs JSON e correlacionar request IDs entre serviços, com Loki. Ainda não há Prometheus, Grafana ou Loki nesta etapa.
6. **CI:** builds, testes e verificações de segurança no GitHub Actions.

Em produção também precisaremos de TLS, autenticação, gestão de segredos, backups testados e atualizações das imagens. Health checks são verificações pontuais; observabilidade ajuda a explicar o comportamento do sistema.

### Contrato de saúde e futura instrumentação

| Endpoint | Verificação | Uso |
|---|---|---|
| `/api/health/live` | Processo HTTP responde | Liveness probe Kubernetes |
| `/api/health/ready` | Processo responde e consulta SQLite | Health check Docker e readiness probe Kubernetes |
| `/api/health` | Alias de readiness | Diagnóstico manual |
| `/health` no frontend | Nginx responde | Health check do frontend |

A readiness retorna HTTP 503 se o banco estiver indisponível. Liveness não depende do banco, para evitar reinícios quando uma dependência falha. Ao migrar para PostgreSQL, atualizaremos a consulta de readiness. O Prometheus precisará de um endpoint de métricas separado, a implementar na etapa de observabilidade; não coleta métricas automaticamente desses endpoints JSON.

## Convenções

- Branch por funcionalidade: `feat/docker-task-app`, `feat/kubernetes-local`, `feat/observability`; correções em `fix/<assunto>` e documentação em `docs/<assunto>`.
- Commits após validação, seguindo Conventional Commits e a identidade configurada pelo usuário, sem atribuição ao modelo.
- Sem push, merge, instalação global ou exclusão de volumes sem autorização.
- Uma etapa por vez, com explicação, validação e confirmação do aprendizado.

Leia [AGENTS.md](AGENTS.md) e [o roadmap](docs/ROADMAP.md).

Para aprender a configurar cada arquivo e validar cada conceito, siga [o guia prático de Docker](docs/DOCKER.md) e [o guia Kubernetes](docs/KUBERNETES.md), com o backend validado e a sequência futura do frontend.

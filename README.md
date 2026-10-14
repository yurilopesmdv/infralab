# InfraLab

Laboratório para aprender Docker, Kubernetes e operação de aplicações com uma lista de tarefas simples em React, Node.js, TypeScript e banco de dados.

O foco é entender como construir imagens, conectar serviços, persistir dados, implantar no Kubernetes e investigar comportamento em operação. A aplicação é pequena para que a infraestrutura permaneça visível: sem framework HTTP, ORM ou dependências de teste externas.

## Por onde começar

1. Leia [a visão geral e o glossário](guias/implementacao/00-visao-geral-e-glossario.md): camadas, containers, Pods, Deployments, Services, armazenamento e tipos utilizados.
2. Siga [o índice sequencial](guias/implementacao/README.md), do ambiente até carga/HPA e diagnóstico.
3. Use [os documentos de operação](docs/README.md) para consultar decisões, resultados e procedimentos específicos.
4. Confira [o roadmap](docs/ROADMAP.md) para distinguir implementação concluída, validação pendente e evolução futura.

Todos os comandos dos guias partem da raiz deste repositório, no terminal Ubuntu WSL. Não aplique todos os manifests Kubernetes de uma vez: há arquivos de fases distintas, migração e diagnóstico.

## Estado do projeto

| Área | Implementado e validado | Limite ou pendência |
|---|---|---|
| Docker Compose | React/Nginx, API, SQLite em volume e testes funcionais | Uma API; banco separado do Kubernetes |
| Kubernetes | kind, Services, Deployments, ConfigMap, probes e recursos | Um nó local; acesso por port-forward |
| PostgreSQL | StatefulSet/PVC, migração de uma tarefa e API 0.2.1 | Uma instância de banco, sem alta disponibilidade |
| Proteção de dados | Backup fora do kind e restauração em banco separado | Cópia local; produção exige armazenamento externo |
| Escala | Dez APIs Ready e HPA de duas a dez por CPU | Dimensionamento depende da carga e dos recursos disponíveis |
| Diagnóstico | Logs JSON, request ID, saúde e métricas recentes de recursos | Prometheus, Grafana e centralização de logs futuros |

## Mapa das pastas

| Pasta / arquivo | O que consultar |
|---|---|
| [backend/](backend/README.md) | API Node.js/TypeScript, contrato HTTP, drivers, migração e testes |
| [frontend/](frontend/README.md) | React compilado, Nginx, proxy e relação com a API |
| [k8s/](k8s/README.md) | Manifests, ordem de aplicação e ligação entre recursos |
| [scripts/](scripts/README.md) | Diagnóstico, testes, backup, restauração e gerador de carga |
| [guias/implementacao/](guias/implementacao/README.md) | Glossário e dez capítulos com comandos, exemplos e validação |
| [docs/](docs/README.md) | Documentação operacional, decisões e resultados medidos |
| [compose.yaml](compose.yaml) | Serviços da execução inicial, rede, volume e recursos |
| [compose.postgres-test.yaml](compose.postgres-test.yaml) | Ambiente isolado para testes PostgreSQL |
| [AGENTS.md](AGENTS.md) | Regras técnicas, documentação e fluxo Git |
| `.backups/postgres/` | Backups locais privados; pasta criada pelo script e ignorada pelo Git |

## Como o projeto foi construído

1. **Aplicação mínima:** React para tarefas e API HTTP nativa com SQLite. O contrato `{id, title, done}` permaneceu estável ao mudar de banco.
2. **Containerização:** builds multi-stage, imagens com versões explícitas, execução sem root, health checks e `.dockerignore`. Compose conectou frontend e API, preservando SQLite em volume.
3. **Kubernetes local:** kind recebeu as imagens; Namespace, PVC, Deployment, Service e ConfigMap reproduziram o fluxo da aplicação, com probes e requests/limits.
4. **PostgreSQL:** um StatefulSet e PVC próprios receberam os dados por Job transacional. A leitura SQLite/WAL foi feita sobre snapshot temporário para preservar a origem somente leitura.
5. **Recuperação:** `pg_dump` gerou uma cópia fora do kind; restauração em outro banco conferiu tarefas sem sobrescrever o banco original.
6. **Escala:** múltiplas APIs compartilham PostgreSQL; Metrics Server alimenta o HPA. Nginx reutiliza conexões e a API usa preStop para encerramento controlado.

Cada etapa conecta conceito, implementação e verificação.

## Base do laboratório: aplicação via Docker Compose

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
| `backend/src/store.ts` | Operações SQLite/PostgreSQL, mantendo o contrato HTTP |
| `backend/src/migrate-sqlite.ts` | Cópia transacional para PostgreSQL |
| `backend/Dockerfile` | Compila TypeScript e executa JavaScript |
| `frontend/src/main.tsx` | Interface React e chamadas HTTP |
| `frontend/nginx.conf` | Arquivos estáticos e proxy para a API |
| `frontend/Dockerfile` | Compila React e entrega o resultado com Nginx |
| `backend/tests/app.test.mjs` | Testes HTTP com Node.js nativo |
| `scripts/test-persistence.sh` | Verifica persistência após recriar o backend |

**Imagem** é o pacote usado para criar um container. **Container** é uma instância executável desse pacote. **Volume** mantém dados fora do ciclo de vida do container. **Rede** permite comunicação entre serviços por nome.

Os Dockerfiles copiam as dependências antes do código: alterações no código podem reutilizar a camada de `npm ci`. Os lockfiles fixam a resolução das dependências. As imagens base usam versões explícitas; atualizações de segurança devem ser feitas e testadas deliberadamente. As imagens finais não incluem compiladores nem dependências de desenvolvimento.

## Aplicação no Kubernetes local

O backend está implantado no cluster kind `infralab`, com Deployment `RollingUpdate`, Service interno, probes e limites de recursos. O HPA controla entre duas e dez réplicas por CPU, usando Metrics Server. A API 0.2.1 usa PostgreSQL, executado em StatefulSet com PVC próprio. O PVC `sqlite-data` da etapa anterior permanece preservado, sem montagem na API atual. Os manifests estão em `k8s/`.

```text
Navegador → localhost:8081 → port-forward → Service frontend → Nginx/React
                                                               └─ /api/* → Service backend
                                                                             └─ APIs (2–10)
                                                                                  └─ Service postgres
                                                                                       └─ postgres-0 + PVC
Metrics Server → métricas de CPU → HPA → quantidade de APIs
pg_dump → .backups/postgres/ no WSL, fora do kind
```

O frontend também está implantado com Deployment, Service e ConfigMap Nginx. A configuração encaminha `/api/` para `backend.infralab.svc.cluster.local:3000`, usando o endereço estável do Service. O selector `app: backend` identifica os Pods da API; não é o endereço utilizado pelo navegador.

```bash
kubectl --context kind-infralab get pods,pvc,services -n infralab
kubectl --context kind-infralab port-forward -n infralab service/frontend 8081:8080
```

Abra http://localhost:8081. No segundo terminal: `curl --fail -sS http://localhost:8081/api/health/ready`. O encaminhamento permanece aberto até `Ctrl+C`; o acesso no navegador e o fluxo frontend → API → banco foram validados pelo usuário.

O banco Kubernetes é separado do Compose. O armazenamento local do kind não garante persistência após excluir o cluster. Consulte [o guia Kubernetes](docs/KUBERNETES.md).

### Migração PostgreSQL concluída

PostgreSQL foi implantado e teve conexão SQL e persistência validadas pelo usuário. O Job `sqlite-to-postgres-v2` copiou uma tarefa, preservando ID, estado e origem SQLite. A API 0.2.1 está em execução com PostgreSQL; readiness retornou `database: postgres` e três testes HTTP passaram pelo frontend, cobrindo CRUD e saúde. O código também passou em 13 testes isolados. Para reproduzir a migração, siga [o guia PostgreSQL](docs/POSTGRESQL.md) e aplique o Deployment atualizado somente após copiar os dados.

O Compose principal permanece com SQLite, selecionado por padrão. Para testar PostgreSQL sem alterar o cluster ou esse Compose: `bash scripts/test-postgres.sh`. Escala manual até dez APIs e aumento/redução automática por HPA foram observados. Três testes HTTP passaram durante carga e a tarefa original permaneceu. Veja [escalabilidade e resultados das tentativas](docs/ESCALABILIDADE.md). Observabilidade Prometheus/Grafana ainda não foi implementada.

### Backup e restauração validados

O backup PostgreSQL fica em `.backups/postgres/`, fora do kind e ignorado pelo Git. A restauração em um banco separado foi testada: uma tarefa conferiu em ID, título e estado, preservando o banco original. Execute `bash scripts/backup-postgres.sh` e siga [o guia de restauração](docs/BACKUP-RESTAURACAO.md). A cópia local protege contra perda do cluster; proteção contra perda do computador requer armazenamento externo.

## Evolução e limites

Este laboratório usa acesso local e não tem autenticação. O Compose mantém uma API com SQLite; o Kubernetes usa de duas a dez réplicas da API conectadas a uma instância PostgreSQL, todas no mesmo nó kind. Não é uma configuração pronta para exposição pública nem oferece alta disponibilidade do banco ou entre nós.

Etapas futuras, ainda não implementadas:

1. **Evoluir o acesso Kubernetes:** hoje usamos port-forward temporário; acesso HTTP por um controlador será uma etapa separada, se autorizada.
2. **Aprofundar capacidade:** migração, dez réplicas e HPA local implementados; continuar medindo gargalos e orçamento de conexões com carga representativa.
3. **Produção:** separar clientes de carga, distribuir nós e definir disponibilidade, segurança e recuperação conforme requisitos reais.
4. **Monitoramento:** métricas HTTP, latência e taxa de erros via Prometheus; dashboards e alertas no Grafana.
5. **Observabilidade:** centralizar logs JSON e correlacionar request IDs entre serviços, com Loki. Ainda não há Prometheus, Grafana ou Loki nesta etapa.
6. **CI:** builds, testes e verificações de segurança no GitHub Actions.

Em produção também precisaremos de TLS, autenticação, gestão de segredos, backups testados e atualizações das imagens. Health checks são verificações pontuais; observabilidade ajuda a explicar o comportamento do sistema.

### Contrato de saúde e futura instrumentação

| Endpoint | Verificação | Uso |
|---|---|---|
| `/api/health/live` | Processo HTTP responde | Liveness probe Kubernetes |
| `/api/health/ready` | Processo responde e consulta o banco selecionado | Health check Docker e readiness probe Kubernetes |
| `/api/health` | Alias de readiness | Diagnóstico manual |
| `/health` no frontend | Nginx responde | Health check do frontend |

A readiness retorna HTTP 503 se o banco selecionado estiver indisponível. Liveness não depende do banco, para evitar reinícios quando uma dependência falha. O Prometheus precisará de um endpoint de métricas separado, a implementar na etapa de observabilidade; não coleta métricas automaticamente desses endpoints JSON.

## Convenções

- Branch por funcionalidade: `feat/docker-task-app`, `feat/kubernetes-local`, `feat/observability`; correções em `fix/<assunto>` e documentação em `docs/<assunto>`.
- Commits após validação, seguindo Conventional Commits.
- Sem push, merge, instalação global ou exclusão de volumes sem autorização.
- Uma etapa por vez, com explicação, validação e confirmação do aprendizado.

Leia [AGENTS.md](AGENTS.md) e [o roadmap](docs/ROADMAP.md).

Para reconstruir o laboratório e entender as conexões entre componentes, siga [os dez capítulos sequenciais de implementação](guias/implementacao/README.md), com comandos, exemplos de código/YAML e validação.

Para aprender a configurar cada arquivo e validar cada conceito, siga [o guia prático de Docker](docs/DOCKER.md) e [o guia Kubernetes](docs/KUBERNETES.md), com frontend, backend e persistência validados.

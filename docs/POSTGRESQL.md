# Migrar a API de SQLite para PostgreSQL

## Estado desta etapa

PostgreSQL 17.11 foi implantado com Service headless, StatefulSet e PVC próprios. Conexão autenticada, SQL e persistência após substituição do Pod foram validados. O Job `sqlite-to-postgres-v2` concluiu a migração de uma tarefa e a API 0.2.1 foi implantada. Readiness retornou `database: postgres`; o frontend listou a tarefa original e três testes HTTP passaram no cluster. Treze testes isolados também passaram. **A migração está concluída; os passos abaixo documentam como reproduzi-la em outro ambiente.** Escala e HPA foram estudados posteriormente; veja [o capítulo de escala](ESCALABILIDADE.md).

O Job antigo Failed e o Pod de diagnóstico Error foram preservados para histórico. Esses estados descrevem tentativas já encerradas; frontend, backend e PostgreSQL atuais estão Running 1/1. O PVC original SQLite permanece preservado.

O Compose principal continua com SQLite. Os bancos Compose, SQLite Kubernetes e PostgreSQL Kubernetes são distintos. Só o SQLite Kubernetes será copiado por este Job.

## O que mudou no código

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/store.ts` | Operações de tarefas para SQLite e PostgreSQL |
| `backend/src/postgres.ts` | Pool limitado a cinco conexões e schema SQL |
| `backend/src/server.ts` | Aguarda consultas assíncronas e usa readiness do banco selecionado |
| `backend/src/migrate-sqlite.ts` | Cópia verificada em transação, preservando origem e IDs |
| `k8s/migrations/sqlite-to-postgres-job.yaml` | Executa a cópia uma vez, com SQLite somente leitura |
| `k8s/backend-deployment.yaml` | API 0.2.1 usando PostgreSQL e Secret |
| `k8s/legacy/backend-sqlite-deployment.yaml` | Referência da configuração anterior, sem aplicação automática |

O driver `pg` usa variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` e `PGPASSWORD`. As credenciais vêm do Secret `postgres-credentials`; a senha não está em nenhum manifest. Consultas com `$1`, `$2` separam valores do texto SQL. As operações de atualização/exclusão são atômicas no PostgreSQL, sem uma consulta prévia de existência.

A resposta das tarefas permanece `{id, title, done}`, com `done` em 0/1. O frontend não precisa mudar. IDs usam INTEGER no PostgreSQL; a migração recusa IDs SQLite fora do intervalo suportado em vez de truncá-los.

Readiness executa `SELECT 1` no banco selecionado e retorna 503 quando indisponível. Liveness responde pelo processo HTTP, independentemente do banco. As conexões e consultas têm timeouts limitados; inicialização do schema pode ser tentada novamente pelas próximas requisições se o banco ainda não estiver pronto.

## Antes de começar

Use terminal Ubuntu do WSL na raiz do repositório. Confirme o contexto em todos os comandos. Não use `kubectl apply -f k8s/` para antecipar a troca da API: o Deployment preparado aponta para PostgreSQL e deve ser aplicado **depois** da migração.

```bash
kubectl --context kind-infralab get pods,pvc,services -n infralab
kubectl --context kind-infralab get secret postgres-credentials -n infralab
```

Esperado: PostgreSQL pronto, PVCs `sqlite-data` e `postgres-data-postgres-0` Bound, Secret Opaque com três chaves. Não imprima o conteúdo do Secret.

O Secret foi criado interativamente, fora do Git. Se precisar reconstruir o laboratório do zero, defina a senha sem mostrá-la:

```bash
read -rsp 'Senha PostgreSQL: ' INFRALAB_POSTGRES_PASSWORD
printf '\n'
printf '%s' "$INFRALAB_POSTGRES_PASSWORD" | kubectl --context kind-infralab create secret generic postgres-credentials -n infralab --from-literal=username=infralab --from-literal=database=infralab --from-file=password=/dev/stdin
unset INFRALAB_POSTGRES_PASSWORD
```

Não recrie um Secret já existente. Alterar a senha no Secret não altera automaticamente a senha do banco inicializado: rotação exige uma etapa própria.

## 1. Construir e carregar a nova imagem

```bash
docker build --target runtime -t infralab-backend:0.2.1 backend
kind load docker-image infralab-backend:0.2.1 --name infralab
docker exec infralab-control-plane crictl images
```

`--target runtime` escolhe a etapa de execução, sem incluir os testes. Não substituímos a tag 0.1.0. A nova imagem contém o driver `pg` e o comando de migração compilado. Confira a tag 0.2.1 no nó.

## 2. Validar o Job antes de interromper a API

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/migrations/sqlite-to-postgres-job.yaml
kubectl --context kind-infralab apply --dry-run=server -f k8s/backend-deployment.yaml
```

Esses comandos não executam a cópia. Não continue se houver erro.

## 3. Congelar a origem SQLite

Este passo interrompe temporariamente a API. Finalize qualquer operação pelo navegador antes de executá-lo.

```bash
kubectl --context kind-infralab scale deployment/backend --replicas=0 -n infralab
kubectl --context kind-infralab wait --for=delete pod -l app=backend -n infralab --timeout=120s
kubectl --context kind-infralab get pods -n infralab -l app=backend
```

Esperado: nenhum Pod da API. O PVC permanece. Isso impede novas escritas na origem durante a cópia. Não aplique ainda o Deployment 0.2.1 nem volte a iniciar a API SQLite enquanto a migração roda.

## 4. Executar a cópia em Job

```bash
kubectl --context kind-infralab apply -f k8s/migrations/sqlite-to-postgres-job.yaml
kubectl --context kind-infralab wait --for=condition=complete job/sqlite-to-postgres-v2 -n infralab --timeout=300s
kubectl --context kind-infralab logs job/sqlite-to-postgres-v2 -n infralab
```

Job é um recurso para uma tarefa finita: ao terminar, o processo sai. Diferente do Deployment, não mantém a API rodando. `backoffLimit: 0` evita retentativas automáticas antes de investigar erros. A origem está montada somente leitura. O programa copia o banco e seu WAL, caso exista, para um diretório temporário, e abre essa cópia em modo readOnly. Arquivos auxiliares necessários ao SQLite são criados apenas no diretório temporário, removido ao terminar.

Esperado nos logs: `status: migrated` e a quantidade de tarefas. O programa:

1. Lê as tarefas ordenadas por ID e valida os valores.
2. Abre uma transação PostgreSQL usando uma única conexão.
3. Recusa copiar para `tasks` preenchida sem um registro dessa migração.
4. Insere ID, título e estado, e compara a cópia com a origem.
5. Ajusta a sequência para que novas tarefas não reutilizem IDs importados.
6. Registra o hash e a quantidade em `infralab_migrations` e confirma a transação.

Se o processo falha durante a cópia, a transação reverte as inserções. Repetir o programa com a mesma origem retorna `already-migrated`, sem sobrescrever alterações posteriores do destino. Uma origem diferente após a primeira migração é recusada.

Se houver timeout ou falha, consulte logs e `kubectl --context kind-infralab describe job sqlite-to-postgres -n infralab`. **Não avance para a nova API e não exclua volumes.** Reaplicar um Job concluído não o executa novamente; uma retentativa deve ser preparada conscientemente após investigar o erro, com um novo nome de Job e a mesma origem congelada.

## 5. Iniciar a API PostgreSQL

Somente depois do Job Complete e da conferência dos logs:

```bash
kubectl --context kind-infralab apply -f k8s/backend-deployment.yaml
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
kubectl --context kind-infralab get pods,pvc -n infralab
kubectl --context kind-infralab logs deployment/backend -n infralab --tail=20
```

O manifest atual usa `DB_DRIVER=postgres`, recebe credenciais do Secret e não monta mais SQLite. O PVC antigo permanece preservado. A transição original usou uma réplica e Recreate; o capítulo posterior de escala adotou RollingUpdate e HPA. Por isso o manifest atual omite replicas: em um laboratório novo, aplique o HPA no capítulo de escala ou ajuste manualmente as réplicas antes dele. Não congele escritores para nova migração com um HPA ativo sem preparar a manutenção.

## 6. Validar pelo frontend

Reabra o encaminhamento se necessário:

```bash
kubectl --context kind-infralab port-forward -n infralab service/frontend 8081:8080
```

Em outro terminal:

```bash
curl --fail -sS http://localhost:8081/api/health/ready
curl --fail -sS http://localhost:8081/api/tasks
```

Esperado: `database: postgres` e as tarefas anteriores com os mesmos IDs e estados. No navegador, valide criar, concluir e excluir uma tarefa nova. Confirme as linhas no banco sem revelar senha:

```bash
kubectl --context kind-infralab exec -n infralab postgres-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" -v ON_ERROR_STOP=1 -c "SELECT id, title, done FROM tasks ORDER BY id;"'
```

A tabela `infralab_persistence_check` da aula não é alterada pela migração. Para testar a nova API após substituir seu Pod, use rollout restart, aguarde disponibilidade e repita a listagem; isso interrompe brevemente a API.

## Recuperação e limites

### Diagnosticar uma falha sem repetir a cópia

A execução original com a imagem 0.2.0 falhou ao abrir `tasks.db` num volume somente leitura. O diagnóstico confirmou permissões de leitura para UID 1000, banco em modo WAL e ausência de arquivos auxiliares. A conexão ao PostgreSQL funcionou e a tabela tasks não havia sido criada. A condição WAL foi reproduzida em testes: uma conexão readOnly pode precisar criar arquivos auxiliares. A versão 0.2.1 trabalha sobre uma cópia temporária, preservando o PVC original. Há testes tanto para WAL fechado em diretório sem escrita quanto para registros ainda no arquivo WAL. Referência: [SQLite WAL em bancos somente leitura](https://www.sqlite.org/wal.html#read_only_databases).

O novo manifest cria o Job `sqlite-to-postgres-v2` com a imagem 0.2.1, preservando o Job anterior e seus logs. Construa e carregue essa imagem antes da nova tentativa. Não aplique a nova API antes de confirmar a cópia.

Se o Job retornar a mensagem genérica de falha, mantenha a API parada e preserve os volumes. O Pod opcional `k8s/diagnostics/migration-check-pod.yaml` usa a imagem 0.2.0, as referências do Secret e o SQLite somente leitura. Ele consulta a origem e executa SELECT no PostgreSQL, sem migrar dados nem imprimir senha ou títulos das tarefas.

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/diagnostics/migration-check-pod.yaml
kubectl --context kind-infralab apply -f k8s/diagnostics/migration-check-pod.yaml
kubectl --context kind-infralab get pod migration-check -n infralab
kubectl --context kind-infralab logs pod/migration-check -n infralab
```

Se o container ainda estiver iniciando, repita a consulta de logs após alguns segundos. As etapas `sqlite` e `postgres` mostram separadamente sucesso ou erro com código e mensagem; a senha é removida caso conste na mensagem. Consulte os logs tanto em Succeeded quanto em Error. Não exclua o Job anterior nem execute novamente a migração antes de analisar o resultado.

Antes de novas escritas PostgreSQL, se a troca falhar, a configuração antiga está em `k8s/legacy/backend-sqlite-deployment.yaml`. Aplique-a somente após investigar e confirmar a recuperação. Ela restaura a API 0.1.0 usando o SQLite preservado. Depois de escritas no PostgreSQL, voltar ao SQLite não transfere essas alterações: exige reconciliar os dados primeiro. Não apague o PVC antigo nesta etapa.

Uma réplica PostgreSQL em armazenamento local do kind não oferece alta disponibilidade nem backup. O usuário do laboratório é o usuário de inicialização do banco; produção deve separar administração, migração e permissões da aplicação, usar TLS e gerenciar segredos. Cinco conexões por API não tornam dez réplicas automaticamente adequadas: mediremos capacidade, requests/limits e orçamento de conexões antes de escalar.

## Testes sem alterar o cluster

```bash
bash scripts/test-postgres.sh
```

O script gera uma senha temporária e usa o projeto Compose `infralab-postgres-test`, sem portas publicadas. O banco fica em tmpfs; os recursos de teste são removidos ao terminar. Os testes usam Node.js nativo: CRUD, consultas parametrizadas, cópia/IDs, idempotência, rollback, origem preservada e readiness sem dependência para liveness. SQLite também é testado para manter o Compose original funcionando.

Referências: [pool de conexões](https://node-postgres.com/features/pooling), [consultas parametrizadas](https://node-postgres.com/features/queries) e [transações](https://node-postgres.com/features/transactions).

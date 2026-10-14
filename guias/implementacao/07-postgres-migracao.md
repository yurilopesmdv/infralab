# 07 — PostgreSQL, Secret, StatefulSet e migração

## O que aprender e por quê

PostgreSQL é um servidor de banco acessível pela rede. Todas as APIs compartilham suas transações e dados. StatefulSet oferece identidade estável (`postgres-0`) e associa PVC a cada instância. Isso não configura replicação PostgreSQL automaticamente.

Service headless (`clusterIP: None`) dá suporte ao endereço estável do StatefulSet. No laboratório usamos uma instância. Secret evita senha no YAML, mas base64 não é criptografia nem substitui controles de acesso.

## Criar recursos num laboratório novo

Não recrie o Secret existente. No Ubuntu, crie senha sem imprimi-la:

```bash
read -rsp 'Senha PostgreSQL: ' INFRALAB_POSTGRES_PASSWORD
printf '\n'
printf '%s' "$INFRALAB_POSTGRES_PASSWORD" | kubectl --context kind-infralab create secret generic postgres-credentials -n infralab --from-literal=username=infralab --from-literal=database=infralab --from-file=password=/dev/stdin
unset INFRALAB_POSTGRES_PASSWORD
kubectl --context kind-infralab apply -f k8s/postgres-service.yaml
kubectl --context kind-infralab apply --dry-run=server -f k8s/postgres-statefulset.yaml
kubectl --context kind-infralab apply -f k8s/postgres-statefulset.yaml
kubectl --context kind-infralab rollout status statefulset/postgres -n infralab --timeout=300s
```

Trechos conectados dos manifests completos:

```yaml
# API: endereço do Service e senha existente
- name: PGHOST
  value: postgres.infralab.svc.cluster.local
- name: PGPASSWORD
  valueFrom:
    secretKeyRef:
      name: postgres-credentials
      key: password
```

```yaml
# StatefulSet: cria postgres-data-postgres-0
volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: standard
      resources:
        requests:
          storage: 1Gi
```

`POSTGRES_*` inicializa o banco no primeiro uso do volume; `PG*` configura os clientes. Trocar o Secret não altera automaticamente uma senha já inicializada.

## Migrar somente se houver origem SQLite

Antes de migrar, faça a sequência completa de [docs/POSTGRESQL.md](../../docs/POSTGRESQL.md): valide origem e destino, interrompa escritores SQLite, execute o Job, confira a cópia e só então inicie a API PostgreSQL. Não execute essa migração num banco atual já em uso como se fosse uma inicialização nova.

```bash
kubectl --context kind-infralab scale deployment/backend --replicas=0 -n infralab
kubectl --context kind-infralab wait --for=delete pod -l app=backend -n infralab --timeout=120s
kubectl --context kind-infralab apply -f k8s/migrations/sqlite-to-postgres-job.yaml
kubectl --context kind-infralab wait --for=condition=complete job/sqlite-to-postgres-v2 -n infralab --timeout=300s
kubectl --context kind-infralab logs job/sqlite-to-postgres-v2 -n infralab
```

Esta sequência presume HPA ainda ausente. Se houver autoscaler, ele pode recriar réplicas: planeje uma manutenção própria antes de congelar escritores. No fluxo deste guia, o HPA só aparece no capítulo 09.

O Job preserva a origem, trabalha sobre snapshot temporário SQLite/WAL e copia tarefas em transação. IDs/estado são comparados e a sequência de novos IDs é ajustada. Se falhar, investigue logs; não troque a API nem apague PVCs.

## API PostgreSQL e validação

Após migração concluída, ou diretamente num laboratório novo sem SQLite:

```bash
kubectl --context kind-infralab apply -f k8s/backend-deployment.yaml
kubectl --context kind-infralab apply -f k8s/backend-service.yaml
kubectl --context kind-infralab scale deployment/backend --replicas=2 -n infralab
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
kubectl --context kind-infralab exec -n infralab postgres-0 -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;"'
```

Confira readiness `database: postgres` e tarefas pelo frontend. O pool em `backend/src/postgres.ts` permite cinco conexões por API. Produção deve separar usuário administrador, migração e aplicação, além de TLS e armazenamento adequado.

Pergunta: por que dez Pods PostgreSQL não se tornam automaticamente um banco replicado?

Anterior: [06](06-aplicacao-kubernetes.md). Próximo: [08 — Backup](08-backup.md).

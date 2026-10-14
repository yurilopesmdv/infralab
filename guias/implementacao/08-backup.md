# 08 — Persistência e recuperação

## O que aprender e por quê

PVC conserva dados ao substituir Pod, enquanto o armazenamento existir. Backup permite recuperar uma cópia. Alta disponibilidade reduz interrupção; não impede exclusão acidental de dados replicada para todas as instâncias.

## Execução

```bash
bash scripts/backup-postgres.sh
# Use o caminho impresso pelo comando anterior:
bash scripts/verify-postgres-restore.sh .backups/postgres/SEU_BACKUP.dump
```

O primeiro script executa `pg_dump -Fc` e salva fora do kind, com permissões restritas e checksum. O segundo confere checksum e restaura num banco novo usando uma transação, sem substituir o banco original.

## Validação e limites

Resultado esperado: todas as tarefas conferem em ID, título e estado; API original continua saudável. Novas escritas entre backup e comparação podem explicar diferenças. Evite editar tarefas durante esse exercício.

O banco de teste fica preservado. Backups não entram no Git e podem conter dados sensíveis. A cópia WSL protege contra perda do cluster, mas produção precisa de armazenamento externo, retenção, criptografia e testes de recuperação. RPO define perda de dados aceitável; RTO define prazo de recuperação. PITR com WAL permite recuperar além do instante de um dump.

Detalhes e resultado real em [docs/BACKUP-RESTAURACAO.md](../../docs/BACKUP-RESTAURACAO.md).

Pergunta: perder a máquina que contém cluster e backup local permite recuperar os dados?

Anterior: [07](07-postgres-migracao.md). Próximo: [09 — Carga e HPA](09-carga-hpa.md).

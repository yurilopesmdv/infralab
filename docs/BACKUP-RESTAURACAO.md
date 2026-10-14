# Backup PostgreSQL e teste de restauração

## Objetivo

Todas as réplicas da API usam o mesmo PostgreSQL. O PVC preserva dados quando o Pod é substituído; um backup fora do kind permite recuperar dados se o cluster for perdido. Replicação e alta disponibilidade são mecanismos diferentes e não substituem backup.

Neste laboratório salvamos uma cópia lógica no filesystem Ubuntu do WSL e restauramos em outro banco da mesma instância PostgreSQL. O banco da aplicação permanece intacto. A cópia local não protege contra perda do computador.

## 1. Criar a cópia

Na raiz do projeto, no terminal Ubuntu:

```bash
bash scripts/backup-postgres.sh
```

O script executa `pg_dump` dentro de `postgres-0`, usando as credenciais já presentes no ambiente do Pod. A senha não é impressa nem salva no arquivo de backup.

- `-Fc`: arquivo customizado comprimido, aceito por `pg_restore`.
- A saída binária é redirecionada para `.backups/postgres/`, fora do cluster. Não usamos terminal TTY para transportar o arquivo.
- Um nome único em UTC evita sobrescrever backups anteriores; arquivos incompletos têm sufixo `.partial`.
- `pg_restore --list` verifica se o catálogo do arquivo pode ser lido.
- `sha256sum` gera uma verificação de integridade. Checksum não é criptografia.

A pasta tem permissão `700`; arquivos têm `600` e são ignorados pelo Git. O dump copia um banco, incluindo suas tabelas e sequências; não copia usuários globais nem a configuração do servidor.

## 2. Restaurar em um banco separado

Use o caminho impresso pelo comando anterior:

```bash
bash scripts/verify-postgres-restore.sh .backups/postgres/SEU_BACKUP.dump
```

O script confere o checksum, cria um banco com nome exclusivo `infralab_restore_*` e recebe o arquivo por `kubectl exec -i`. A opção `-i` mantém a entrada padrão aberta.

`pg_restore --single-transaction --exit-on-error` restaura numa transação e interrompe em caso de erro. `--no-owner --no-acl` usa o usuário do laboratório sem reproduzir proprietários ou permissões do ambiente de origem. Não usamos `--clean` e não removemos o banco original.

A validação compara quantidade e resumo dos campos `id`, `title` e `done` de todas as tarefas, ordenadas pelo ID. Se houver novas escritas depois do backup, o banco atual pode diferir legitimamente da cópia; faça esse exercício sem editar tarefas entre os dois comandos.

O banco de teste permanece para inspeção. Sua remoção exige autorização separada.

## 3. Validar a aplicação

Com o port-forward do frontend ativo:

```bash
curl --fail -sS http://localhost:8081/api/health/ready
curl --fail -sS http://localhost:8081/api/tasks
```

Esperado: readiness com `database: postgres` e tarefas originais disponíveis. A restauração de teste não altera a conexão da API.

## Resultado validado em 14/10/2026

Backup `infralab-20261014T185456Z-D3wDr9.dump` criado fora do kind, checksum conferido e restauração concluída no banco `infralab_restore_20261014185700_60943`. Uma tarefa conferiu em ID, título e estado. Banco original e volumes preservados.

## Aplicação em produção

Defina RPO (quanto tempo de dados pode ser perdido) e RTO (tempo aceitável para recuperar o serviço). Automatize backups com retenção, armazenamento externo criptografado e testes periódicos de restauração em ambiente separado. Para recuperar até um instante específico, avalie backup físico com arquivamento de WAL/PITR; para disponibilidade, avalie PostgreSQL gerenciado com alta disponibilidade. Um dump recupera a situação da sua cópia, não escritas posteriores.

Referências: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) e [arquivamento contínuo/PITR](https://www.postgresql.org/docs/17/continuous-archiving.html).

Depois desta etapa, retomamos [escala e carga](ESCALABILIDADE.md). Os guias sequenciais em `guias/implementacao/` serão consolidados ao terminar o backlog de Kubernetes, antes de Prometheus.

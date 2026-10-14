# Scripts — execução e finalidade

Execute pela raiz do repositório, no Ubuntu WSL. Shell orquestra ferramentas; testes e carga HTTP usam JavaScript com Node.js, sem dependências de teste externas.

| Comando / arquivo | Finalidade e efeito |
|---|---|
| `bash scripts/check-environment.sh` | Consulta ferramentas e disponibilidade do ambiente |
| `bash scripts/test-persistence.sh` | Cria tarefa temporária, recria backend Compose preservando volume, confere e exclui somente a tarefa de teste |
| `bash scripts/test-postgres.sh` | Sobe ambiente PostgreSQL isolado, executa testes Node e limpa seus recursos temporários |
| `bash scripts/backup-postgres.sh` | Gera dump PostgreSQL fora do kind, com checksum e permissões restritas |
| `bash scripts/verify-postgres-restore.sh CAMINHO.dump` | Confere checksum, restaura em banco novo e compara tarefas; preserva banco de teste |
| [load-http.mjs](load-http.mjs) | Gerador de leituras Node, duração/concorrência/taxa limitadas e erros classificados |

O gerador roda em Job separado com [k8s/load-job.yaml](../k8s/load-job.yaml). O script precisa estar na ConfigMap load-http-script. O manifesto final define alvo aproximado de 200 operações/s, concorrência máxima oito e duração de 60 segundos. `REQUESTS_PER_SECOND=0` remove limite de taxa; use-o somente para um teste de estresse planejado.

Qualquer erro HTTP, timeout ou resposta inválida faz o gerador sair com código diferente de zero; o Job fica Failed. Leia `failures` nos logs, investigue e preserve evidências antes de repetir.

Backups podem conter dados sensíveis e ficam em `.backups/`, ignorada pelo Git. Não exclua volumes ou bancos para limpar testes sem decidir explicitamente o destino dos dados.

Procedimentos completos: [backup](../docs/BACKUP-RESTAURACAO.md), [carga/HPA](../guias/implementacao/09-carga-hpa.md) e [resultados](../docs/ESCALABILIDADE.md). Voltar ao [projeto](../README.md).

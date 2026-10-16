# Documentação operacional

Os [guias sequenciais](../guias/implementacao/README.md) ensinam a implementação em ordem. Esta pasta aprofunda configuração, decisões, resultados e limites das etapas.

| Documento | Quando consultar |
|---|---|
| [SETUP-VSCODE.md](SETUP-VSCODE.md) | Trabalhar no Ubuntu WSL e conferir o ambiente |
| [DOCKER.md](DOCKER.md) | Dockerfiles, Compose, camadas, rede, volume e validação |
| [KUBERNETES.md](KUBERNETES.md) | Registro da aula inicial SQLite; comandos históricos identificados |
| [POSTGRESQL.md](POSTGRESQL.md) | Secret, StatefulSet, migração, snapshot WAL e recuperação |
| [BACKUP-RESTAURACAO.md](BACKUP-RESTAURACAO.md) | Dump fora do kind e restauração em banco separado |
| [ESCALABILIDADE.md](ESCALABILIDADE.md) | HPA, dimensionamento e procedimentos de carga |
| [OBSERVABILIDADE.md](OBSERVABILIDADE.md) | Arquitetura, configuração, validação e limites de Prometheus/Grafana |
| [ROADMAP.md](ROADMAP.md) | Etapas concluídas e trabalho pendente |

O estado atual usa PostgreSQL e HPA. Não interprete manifests/comandos históricos SQLite como uma orientação para trocar o banco atual. Em caso de divergência, confira estado atual, seção de retomada e arquivo real antes de executar mudanças.

Prometheus/Grafana e Loki/Alloy estão implantados. Consulte [o guia de logs](../guias/implementacao/14-loki-e-logs-centralizados.md); notificações externas permanecem futuras.

Voltar ao [projeto](../README.md) ou começar pelo [glossário](../guias/implementacao/00-visao-geral-e-glossario.md).

# Guia sequencial InfraLab

Execute comandos na raiz do repositório, no Ubuntu WSL. Estes capítulos explicam os arquivos reais do projeto; não copie todos os YAML de exemplo como se fossem manifests completos. Os caminhos indicados contêm os manifests completos.

| Ordem | Capítulo | Resultado |
|---|---|---|
| 00 | [Visão geral e glossário](00-visao-geral-e-glossario.md) | Camadas, recursos, tipos e conexões compreendidos |
| 01 | [Ambiente](01-ambiente.md) | Docker e cluster acessíveis |
| 02 | [API e SQLite](02-api-sqlite.md) | Contrato HTTP e persistência compreendidos |
| 03 | [Frontend e Nginx](03-frontend-nginx.md) | Navegador conectado à API |
| 04 | [Imagens e Compose](04-docker-compose.md) | Aplicação em containers |
| 05 | [kind e Kubernetes](05-kind-kubernetes.md) | Namespace e imagens no nó |
| 06 | [Aplicação Kubernetes](06-aplicacao-kubernetes.md) | Services, probes e fluxo HTTP |
| 07 | [PostgreSQL e migração](07-postgres-migracao.md) | Banco compartilhado para múltiplas APIs |
| 08 | [Backup e recuperação](08-backup.md) | Cópia fora do cluster e restauração testada |
| 09 | [Carga e HPA](09-carga-hpa.md) | Escala manual e automática |
| 10 | [Diagnóstico](10-diagnostico-observabilidade.md) | Operação e conexão com observabilidade |
| 11 | [Prometheus](11-prometheus.md) | Métricas, coleta por Pod, PromQL e regras locais |
| 12 | [Grafana](12-grafana.md) | Fonte de dados, dashboard e interpretação |
| 13 | [Gerar dados e criar gráficos](13-gerar-dados-e-criar-graficos.md) | Carga de cinco minutos, navegação e painel próprio |

| 14 | [Loki e logs centralizados](14-loki-e-logs-centralizados.md) | Coleta Alloy, armazenamento Loki e correlação por request ID |

Há dois caminhos no capítulo 06: reproduzir a aula histórica SQLite, ou implantar PostgreSQL diretamente num laboratório novo. Em um cluster já migrado, preserve o estado atual e use apenas validações. Não reaplique o Deployment SQLite para voltar à origem: novas escritas PostgreSQL não existem nele.

Esta sequência não remove clusters, PVCs, Secrets nem bancos. Instalações e mudanças globais são decisões separadas. Prometheus/Grafana são tratados nos capítulos 11 e 12; os endpoints de saúde não substituem métricas.

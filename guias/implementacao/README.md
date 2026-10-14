# Guia sequencial InfraLab

Execute comandos na raiz do repositório, no Ubuntu WSL. Estes capítulos explicam os arquivos reais do projeto; não copie todos os YAML de exemplo como se fossem manifests completos. Os caminhos indicados contêm os manifests completos.

| Ordem | Capítulo | Resultado |
|---|---|---|
| 01 | [Ambiente](01-ambiente.md) | Docker e cluster acessíveis |
| 02 | [API e SQLite](02-api-sqlite.md) | Contrato HTTP e persistência compreendidos |
| 03 | [Frontend e Nginx](03-frontend-nginx.md) | Navegador conectado à API |
| 04 | [Imagens e Compose](04-docker-compose.md) | Aplicação em containers |
| 05 | [kind e Kubernetes](05-kind-kubernetes.md) | Namespace e imagens no nó |
| 06 | [Aplicação Kubernetes](06-aplicacao-kubernetes.md) | Services, probes e fluxo HTTP |
| 07 | [PostgreSQL e migração](07-postgres-migracao.md) | Banco compartilhado para múltiplas APIs |
| 08 | [Backup e recuperação](08-backup.md) | Cópia fora do cluster e restauração testada |
| 09 | [Carga e HPA](09-carga-hpa.md) | Escala manual e automática |
| 10 | [Diagnóstico e próxima etapa](10-diagnostico-observabilidade.md) | Operação e preparação para Prometheus |

Há dois caminhos no capítulo 06: reproduzir a aula histórica SQLite, ou implantar PostgreSQL diretamente num laboratório novo. Em um cluster já migrado, preserve o estado atual e use apenas validações. Não reaplique o Deployment SQLite para voltar à origem: novas escritas PostgreSQL não existem nele.

Esta sequência não remove clusters, PVCs, Secrets nem bancos. Instalações e mudanças globais são decisões separadas. Prometheus/Grafana serão o próximo módulo; os endpoints de saúde não substituem métricas.

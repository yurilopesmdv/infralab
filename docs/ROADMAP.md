# Roadmap

- [x] 1. WSL Ubuntu, Docker Desktop integrado, Docker Compose, Git e hello-world.
- [x] 2. Docker: imagens, containers, Dockerfile, camadas, redes, volumes e logs.
- [x] 3. Aplicação: React/Vite, API HTTP Node.js/TypeScript, SQLite persistido, CRUD e Compose.
- [x] 4. Hardening local: multi-stage, non-root, health checks, .dockerignore, recursos e secrets.
- [x] 5. Kubernetes local: kind, kubectl, Pods, Deployments, Services, ConfigMaps e volumes.
- [x] 6. Migrar para PostgreSQL e escalar a API para 10 réplicas; HPA e testes de carga moderada.
- [ ] 7. Observabilidade: Prometheus, Grafana e métricas HTTP implantados; logs JSON/requestId existentes; centralização Loki futura.
- [ ] 8. CI no GitHub Actions, scans, documentação e demonstração.

Cada módulo deve ter comandos, explicações, validação e commit Git em branch própria, seguindo Conventional Commits. Push e merge dependem de autorização.

A aplicação via Compose está validada. A API usa HTTP nativo do Node.js, sem Express, para reduzir dependências.

Módulo 5 validado: cluster kind, imagens carregadas, Namespace, Deployments, probes, recursos, Services, PVC e ConfigMap Nginx. A persistência foi confirmada após substituir o Pod, e o fluxo completo foi testado no navegador via port-forward do frontend.

Módulo 6 concluído para o laboratório: PostgreSQL com StatefulSet/PVC, migração, escala até dez APIs e HPA validados. Em 16/10/2026, carga moderada com alvo de 200 operações/s passou sem erros por 60 segundos, tanto em estado estável quanto durante RollingUpdate. Três testes funcionais passaram e os dados originais permaneceram iguais. Isso não comprova capacidade máxima. SQLite original preservado; observabilidade continua futura. Veja docs/POSTGRESQL.md e docs/ESCALABILIDADE.md.

Sequência acordada antes de Prometheus: validar escala gradual da API, teste de carga e HPA; depois criar `guias/implementacao/` com arquivos Markdown numerados. Os guias devem ensinar ambiente, arquitetura, frontend React/Nginx, API, SQLite/volumes, Compose/redes, kind, Deployments/Services/ConfigMaps/probes, PostgreSQL/Secret/PVC/migração e escalabilidade. Cada etapa terá comandos explicados, exemplos de código/YAML, validação, resultados esperados e ligação explícita com a etapa anterior e seguinte. Só depois iniciar Prometheus/Grafana. CI permanece uma etapa futura.

Metrics Server 0.8.1 fornece CPU ao HPA, com duas a dez réplicas e alvo de 60%. Nginx usa conexões reutilizadas; API usa RollingUpdate e preStop. Carga moderada estável e durante atualização passou com zero erros e p95 de 2 ms em ambos os cenários. O diagnóstico das tentativas anteriores e o alcance da validação estão em docs/ESCALABILIDADE.md. Prometheus/Grafana foram implantados no módulo seguinte; veja docs/OBSERVABILIDADE.md.

Proteção de dados validada: backup lógico PostgreSQL fora do kind, checksum e restauração em banco separado, com comparação de todas as tarefas. Banco original preservado. Backup local não substitui armazenamento externo, retenção e recuperação testada em produção. Veja docs/BACKUP-RESTAURACAO.md.

Guias concluídos em `guias/implementacao/`: glossário e capítulos numerados de 01 a 13, cobrindo ambiente, API, React/Nginx, imagens/Compose, kind, manifests/probes, PostgreSQL/migração, backup, carga/HPA e diagnóstico. A validação de carga moderada foi concluída; a observabilidade com Prometheus/Grafana está documentada nos capítulos 11 e 12.

Prometheus/Grafana implantados em 16/10/2026: API 0.3.0 com cliente oficial de métricas, coleta por Pod, PVCs próprios, fonte/dashboard provisionados e duas regras locais. Quinze testes isolados, quatro testes HTTP no cluster e quatro verificações da observabilidade passaram. Carga de um minuto com alvo de 200 operações/s terminou sem erros. Módulo 7 permanece aberto para centralização de logs; notificações externas também são futuras.

Demonstração de observabilidade: dashboard inicial com nove painéis, janela padrão de 30 minutos e Job de leitura de cinco minutos. Capítulo 13 ensina geração de tráfego, status HTTP e criação de gráfico próprio pela interface. A verificação de targets aceita quantidade variável conforme o HPA.

## Pendências do escopo

- Centralização de logs com Loki e consulta/correlação por request ID.
- CI no GitHub Actions para builds, testes e verificações de segurança.
- Encaminhamento de alertas para notificações externas; hoje as regras são avaliadas localmente.

Evoluções operacionais: automatizar backups com retenção e cópia fora da máquina. O backup/restauração atual foi validado, mas sua cópia é local. Acesso por controlador HTTP, TLS e alta disponibilidade continuam evoluções de produção, sem implementação nesta etapa. Hardening marcado acima refere-se ao laboratório, não a uma certificação de segurança de produção.

Demonstração de cinco minutos concluída: Job observability-demo-l8t4f, 58.951 leituras em 300 segundos, zero erros, 196,5 operações/s e p95 de 2 ms.

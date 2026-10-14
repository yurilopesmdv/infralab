# Roadmap

- [x] 1. WSL Ubuntu, Docker Desktop integrado, Docker Compose, Git e hello-world.
- [ ] 2. Docker: imagens, containers, Dockerfile, camadas, redes, volumes e logs.
- [x] 3. Aplicação: React/Vite, API HTTP Node.js/TypeScript, SQLite persistido, CRUD e Compose.
- [ ] 4. Hardening: multi-stage, non-root, health checks, .dockerignore, recursos e secrets.
- [x] 5. Kubernetes local: kind, kubectl, Pods, Deployments, Services, ConfigMaps e volumes.
- [ ] 6. Migrar para PostgreSQL e escalar a API para 10 réplicas; HPA e testes de carga.
- [ ] 7. Observabilidade: Prometheus, Grafana, métricas HTTP, logs JSON, requestId e Loki.
- [ ] 8. CI no GitHub Actions, scans, documentação e demonstração.

Cada módulo deve ter comandos, explicações, validação e commit Git em branch própria, seguindo Conventional Commits e a identidade configurada pelo usuário. Push e merge dependem de autorização.

A aplicação via Compose está validada. A API usa HTTP nativo do Node.js, sem Express, para reduzir dependências.

Módulo 5 validado: cluster kind, imagens carregadas, Namespace, Deployments, probes, recursos, Services, PVC e ConfigMap Nginx. A persistência foi confirmada após substituir o Pod, e o fluxo completo foi testado no navegador via port-forward do frontend.

Módulo 6 em andamento: PostgreSQL com StatefulSet/PVC e conexão SQL/persistência validados. Job sqlite-to-postgres-v2 concluiu a cópia de uma tarefa; API 0.2.1 está usando PostgreSQL, com três testes HTTP no cluster aprovados e 13 testes isolados. SQLite original preservado. Dez réplicas e HPA foram validados; reteste de carga ainda pendente. Observabilidade continua futura. Veja docs/POSTGRESQL.md e docs/ESCALABILIDADE.md.

Sequência acordada antes de Prometheus: validar escala gradual da API, teste de carga e HPA; depois criar `guias/implementacao/` com arquivos Markdown numerados. Os guias devem ensinar ambiente, arquitetura, frontend React/Nginx, API, SQLite/volumes, Compose/redes, kind, Deployments/Services/ConfigMaps/probes, PostgreSQL/Secret/PVC/migração e escalabilidade. Cada etapa terá comandos explicados, exemplos de código/YAML, validação, resultados esperados e ligação explícita com a etapa anterior e seguinte. Só depois iniciar Prometheus/Grafana. CI permanece uma etapa futura.

Escala manual até dez e aumento/redução automática por HPA validados. Metrics Server 0.8.1 instalado; HPA entre duas e dez, alvo CPU 60%. RollingUpdate/preStop implementados. Carga detectou timeouts/502; Nginx agora reutiliza conexões, com sintaxe e três testes funcionais aprovados. Reteste de carga da configuração final fica para a próxima sessão, por solicitação do usuário. Módulo 6 permanece em andamento até essa validação; veja docs/ESCALABILIDADE.md. Prometheus/Grafana continuam futuros.

Proteção de dados validada: backup lógico PostgreSQL fora do kind, checksum e restauração em banco separado, com comparação de todas as tarefas. Banco original preservado. Backup local não substitui armazenamento externo, retenção e recuperação testada em produção. Veja docs/BACKUP-RESTAURACAO.md.

Guias concluídos em `guias/implementacao/`: índice e dez capítulos numerados, cobrindo ambiente, API, React/Nginx, imagens/Compose, kind, manifests/probes, PostgreSQL/migração, backup, carga/HPA e diagnóstico. A pedido do usuário, a documentação foi finalizada antes do reteste de carga, que será retomado na próxima sessão, antes de Prometheus.

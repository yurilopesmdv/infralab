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

Módulo 6 em andamento: PostgreSQL com StatefulSet/PVC e conexão SQL/persistência validados. Job sqlite-to-postgres-v2 concluiu a cópia de uma tarefa; API 0.2.1 está usando PostgreSQL, com três testes HTTP no cluster aprovados e 13 testes isolados. SQLite original preservado. Dez réplicas, HPA, carga e observabilidade continuam futuros. Veja docs/POSTGRESQL.md.

Sequência acordada antes de Prometheus: validar escala gradual da API, teste de carga e HPA; depois criar `guias/implementacao/` com arquivos Markdown numerados. Os guias devem ensinar ambiente, arquitetura, frontend React/Nginx, API, SQLite/volumes, Compose/redes, kind, Deployments/Services/ConfigMaps/probes, PostgreSQL/Secret/PVC/migração e escalabilidade. Cada etapa terá comandos explicados, exemplos de código/YAML, validação, resultados esperados e ligação explícita com a etapa anterior e seguinte. Só depois iniciar Prometheus/Grafana. CI permanece uma etapa futura.

Escala inicial validada: duas réplicas da API Ready, Service com dois endpoints e três testes HTTP aprovados. API de métricas ainda ausente. Próximos passos: carga controlada, escala até dez e HPA. Veja docs/ESCALABILIDADE.md.

Proteção de dados validada: backup lógico PostgreSQL fora do kind, checksum e restauração em banco separado, com comparação de todas as tarefas. Banco original preservado. Backup local não substitui armazenamento externo, retenção e recuperação testada em produção. Veja docs/BACKUP-RESTAURACAO.md.

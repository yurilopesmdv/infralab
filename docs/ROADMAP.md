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

Módulo 6 em andamento: PostgreSQL com StatefulSet/PVC e conexão SQL/persistência validados pelo usuário. API 0.2.0, Job de cópia e testes de migração preparados; execução da migração e troca da API no cluster ainda pendentes. Dez réplicas, HPA, carga e observabilidade continuam futuros. Veja docs/POSTGRESQL.md.

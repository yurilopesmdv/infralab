# Roadmap

- [x] 1. WSL Ubuntu, Docker Desktop integrado, Docker Compose, Git e hello-world.
- [ ] 2. Docker: imagens, containers, Dockerfile, camadas, redes, volumes e logs.
- [x] 3. Aplicação: React/Vite, API HTTP Node.js/TypeScript, SQLite persistido, CRUD e Compose.
- [ ] 4. Hardening: multi-stage, non-root, health checks, .dockerignore, recursos e secrets.
- [ ] 5. Kubernetes local: kind, kubectl, Pods, Deployments, Services, ConfigMaps e volumes.
- [ ] 6. Migrar para PostgreSQL e escalar a API para 10 réplicas; HPA e testes de carga.
- [ ] 7. Observabilidade: Prometheus, Grafana, métricas HTTP, logs JSON, requestId e Loki.
- [ ] 8. CI no GitHub Actions, scans, documentação e demonstração.

Cada módulo deve ter comandos, explicações, validação e commit Git em branch própria, seguindo Conventional Commits e a identidade configurada pelo usuário. Push e merge dependem de autorização.

A etapa atual combina os fundamentos necessários de Docker com a aplicação mínima via Compose. A API usa HTTP nativo do Node.js, sem Express, para reduzir dependências. Kubernetes, PostgreSQL e observabilidade serão implementados após validar esta base.

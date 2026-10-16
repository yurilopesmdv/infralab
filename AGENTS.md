# InfraLab — instruções do projeto

Responda em português e ensine Docker/Kubernetes passo a passo. Leia README.md e docs/ROADMAP.md antes de implementar. Trabalhe apenas no módulo autorizado, explique comandos antes de executá-los e forneça testes de validação. Não execute comandos destrutivos ou altere configuração global sem pedir autorização. Não armazene segredos no Git. Prefira imagens Docker multi-stage, non-root, .dockerignore, health checks, limites de recursos e logs estruturados. SQLite com volume funciona para a fase de uma réplica; antes de escalar escrita para 10 réplicas, migre para PostgreSQL. Evite overengineering.

## Git e documentação

- Mantenha testes de aplicação em JavaScript/TypeScript com o test runner nativo do Node.js; use shell somente para orquestrar Docker. Não introduza Python neste projeto.
- Preserve os endpoints de liveness e readiness e atualize a verificação de banco ao migrar para PostgreSQL. Métricas Prometheus serão uma interface separada.

- Trabalhe em uma branch por funcionalidade: `feat/<funcionalidade>`, `fix/<correcao>` ou `docs/<assunto>`.
- Faça commits automaticamente após validar a etapa autorizada, usando Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Não altere a configuração global do Git. Não faça push ou merge sem autorização.
- Inclua alterações anteriores somente quando fizerem parte do escopo autorizado; confira o diff antes de cada commit.
- Mantenha o README com arquitetura, execução, validação e limites do laboratório. Diferencie funcionalidades implementadas de etapas futuras.
- Após concluir escala, carga e HPA, criar `guias/implementacao/` com Markdown numerado, comandos, código/YAML e conexões entre Docker, frontend/Nginx, API, banco e Kubernetes. Finalizar esse guia antes de começar Prometheus; cada capítulo deve conectar pré-requisitos, implementação e validação à próxima etapa.

Etapa atual: Compose permanece SQLite; Kubernetes usa API 0.3.0 com PostgreSQL, métricas /metrics e HPA entre duas e dez APIs. Migração, backup/restauração, escala e carga moderada estável/durante RollingUpdate validados. Prometheus 3.15.0 e Grafana 13.2.4 implantados com PVCs próprios, coleta por Pod, dashboard provisionado e regras locais. Credencial Grafana fica em Secret e arquivo local .secrets/ ignorado pelo Git; nunca imprimir ou versionar seu conteúdo. Guias 11 a 14 explicam métricas, dashboards e logs. Loki 3.7.8 e Alloy 1.20.1 centralizam logs de API/Nginx, com request ID no conteúdo JSON, sem indexá-lo como label. Coleta e correlação foram validadas. Tracing e notificações externas permanecem futuros. Preserve volumes e logs anteriores. Não declare capacidade máxima ou aprovação da carga de estresse; valide somente o cenário medido.

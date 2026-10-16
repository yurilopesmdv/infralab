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

Etapa atual: Compose permanece SQLite; Kubernetes usa API 0.2.1 com PostgreSQL. Migração, backup/restauração e escala até dez validados. Metrics Server/HPA ativos, com mínimo duas e máximo dez APIs. Em 16/10/2026, carga moderada com alvo de 200 operações/s por 60 segundos passou sem erros, tanto estável quanto durante RollingUpdate; três testes funcionais passaram e os dados originais foram preservados. Isso não comprova capacidade máxima nem aprova a carga de estresse anterior. Guias sequenciais estão em guias/implementacao/. Próximo módulo: observabilidade, ainda não implementada. Preserve PVCs e logs das tentativas. O projeto ensina Kubernetes passo a passo; execute comandos quando autorizados e acompanhe cada etapa com código revisado, documentação e commits.

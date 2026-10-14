# InfraLab — instruções para o Codex

Responda em português e ensine Docker/Kubernetes passo a passo. Leia README.md e docs/ROADMAP.md antes de implementar. Trabalhe apenas no módulo autorizado, explique comandos antes de executá-los e forneça testes de validação. Não execute comandos destrutivos ou altere configuração global sem pedir autorização. Não armazene segredos no Git. Prefira imagens Docker multi-stage, non-root, .dockerignore, health checks, limites de recursos e logs estruturados. SQLite com volume funciona para a fase de uma réplica; antes de escalar escrita para 10 réplicas, migre para PostgreSQL. Evite overengineering.

## Git e documentação

- Mantenha testes de aplicação em JavaScript/TypeScript com o test runner nativo do Node.js; use shell somente para orquestrar Docker. Não introduza Python neste projeto.
- Preserve os endpoints de liveness e readiness e atualize a verificação de banco ao migrar para PostgreSQL. Métricas Prometheus serão uma interface separada.

- Trabalhe em uma branch por funcionalidade: `feat/<funcionalidade>`, `fix/<correcao>` ou `docs/<assunto>`.
- Faça commits automaticamente após validar a etapa autorizada, usando Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Use a identidade já configurada no Git. Não mencione o modelo nem adicione atribuição ao assistente nos commits.
- Não altere a configuração global do Git. Não faça push ou merge sem autorização.
- Inclua alterações anteriores somente quando fizerem parte do escopo autorizado; confira o diff antes de cada commit.
- Mantenha o README com arquitetura, execução, validação e limites do laboratório. Diferencie funcionalidades implementadas de etapas futuras.
- Após concluir escala, carga e HPA, criar `guias/implementacao/` com Markdown numerado, comandos, código/YAML e conexões entre Docker, frontend/Nginx, API, banco e Kubernetes. Finalizar esse guia antes de começar Prometheus; cada capítulo deve conectar pré-requisitos, implementação e validação à próxima etapa.

Etapa atual: Compose permanece SQLite; Kubernetes usa API 0.2.1 com PostgreSQL. Migração, backup/restauração e escala até dez validados. Metrics Server/HPA ativos, com mínimo duas e máximo dez APIs. Carga teve timeouts/502; Nginx final usa keepalive e passou em sintaxe e três testes funcionais, mas o reteste de carga ficou para a próxima sessão por solicitação do usuário. Guias sequenciais estão em guias/implementacao/. Retome esse reteste antes de Prometheus; não declare capacidade sustentável ainda. Preserve PVCs e logs das tentativas. O usuário pratica Kubernetes; o assistente pode executar comandos quando autorizado e cuida do código, revisão, documentação e commits.

# Guia prático: do código aos containers

Este guia explica a configuração presente no repositório. Execute uma seção por vez pelo terminal Ubuntu do WSL, na raiz do InfraLab. A aplicação não precisa de Node ou npm instalados no host.

## 1. Confirmar o ambiente

Abra Docker Desktop no Windows e confira a integração com sua distribuição WSL. No Ubuntu:

```bash
uname -r
docker version
docker compose version
```

O kernel deve identificar WSL 2. `docker version` deve mostrar `Client` e `Server`: o cliente envia comandos e o servidor executa containers. Se o servidor não responder, investigue a inicialização e a integração do Desktop antes de instalar outro Docker no Ubuntu.

## 2. Entender o desenho

```text
Seu navegador
  ↓ porta 8080 do host
frontend:8080 — Nginx entrega React compilado
  ↓ /api pela rede interna
backend:3000 — Node executa a API
  ↓ leitura e escrita
volume sqlite-data — arquivo tasks.db
```

Uma **imagem** contém arquivos e instruções de execução. Um **container** é uma instância dessa imagem. O **Compose** descreve como iniciar os serviços, conectá-los e disponibilizar armazenamento. SQLite é uma biblioteca dentro do backend; não existe um terceiro container de banco nesta fase.

## 3. Configurar o Dockerfile do backend

Leia `backend/Dockerfile` junto com esta explicação:

1. `FROM node:24.13.0-bookworm-slim AS build`: escolhe a imagem oficial do Node com versão explícita e dá nome à etapa de compilação.
2. `WORKDIR /app`: define o diretório das instruções seguintes.
3. `COPY package*.json ./`: copia o manifesto e o lockfile antes do código.
4. `RUN npm ci`: instala exatamente a resolução do lockfile. Se esses arquivos não mudarem, Docker pode reutilizar essa camada no próximo build.
5. `COPY` do TypeScript e `RUN npm run build`: compilam o código para `dist`.
6. Uma nova etapa `runtime` começa com a imagem Node limpa. `COPY --from=build` traz somente o JavaScript compilado; compilador e dependências de desenvolvimento ficam na etapa anterior.
7. `/app/data` é criado com proprietário `node`. `USER node` evita executar a API como root e permite escrever no volume novo.
8. `EXPOSE 3000` documenta a porta do processo. Não publica essa porta no Windows/WSL; publicação é configurada no Compose.
9. `HEALTHCHECK` consulta readiness periodicamente. `CMD` inicia a API.

A etapa `test` adiciona testes à imagem de execução apenas quando solicitada. Por isso o Compose seleciona explicitamente `target: runtime` para o backend normal.

`backend/.dockerignore` impede enviar `node_modules`, builds locais, banco e arquivos de ambiente ao contexto de build. Não colocar segredos no contexto nem na imagem.

## 4. Configurar o frontend

Leia `frontend/Dockerfile`:

- A etapa Node executa `npm ci` e compila React com Vite.
- A etapa final usa Nginx e recebe apenas os arquivos estáticos de `dist`.
- `USER nginx` executa sem root. A porta interna 8080 e os diretórios temporários em `/tmp` permitem isso.
- `frontend/nginx.conf` entrega a interface e encaminha `/api/` ao backend.

O navegador não conhece o nome Docker `backend`. Ele acessa `/api` no mesmo endereço da página; Nginx resolve `backend` pelo DNS interno do Docker. Não precisamos publicar a API nem adicionar CORS para este desenho.

O servidor Vite não fica rodando no container final. Alterações no código exigem novo build nesta configuração; hot reload pode ser uma etapa futura de desenvolvimento local.

## 5. Configurar Compose, rede e volume

Leia `compose.yaml`:

- `name: infralab` identifica os recursos deste projeto.
- `build` aponta para o diretório de cada Dockerfile.
- `DATABASE_PATH` informa à API onde gravar o SQLite; não é um segredo.
- `sqlite-data:/app/data` monta um volume nomeado no backend. Docker o nomeia `infralab_sqlite-data`.
- `127.0.0.1:8080:8080` significa endereço do host, porta do host e porta do container. A publicação é somente local.
- Compose cria uma rede e permite acessar serviços pelos nomes `backend` e `frontend`.
- `depends_on` com `service_healthy` aguarda a API ficar pronta antes de iniciar o frontend. Isso coordena a inicialização, não garante disponibilidade permanente.
- `mem_limit` limita memória; `cpus: 0.5` limita o tempo de CPU a aproximadamente metade de um núcleo. São valores iniciais de laboratório, a ajustar com medições.
- `init: true` no backend auxilia no tratamento de processos e sinais.
- `no-new-privileges` impede que processos adquiram privilégios adicionais.
- O perfil `test` é opcional e adiciona um serviço temporário de testes; não faz parte do `up` normal.

## 6. Construir e executar

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

O primeiro comando valida o YAML. O segundo constrói imagens e inicia os serviços em segundo plano, aguardando saúde. O terceiro deve mostrar frontend e backend `healthy`, com somente a porta do frontend publicada.

Abra http://localhost:8080 e crie uma tarefa. Se falhar:

```bash
docker compose logs --tail=30 backend frontend
```

Leia o erro antes de alterar a configuração. Um container iniciado não significa que todas as funcionalidades da aplicação estão corretas.

## 7. Entender e validar saúde

```bash
curl --fail http://localhost:8080/api/health/live
curl --fail http://localhost:8080/api/health/ready
docker inspect infralab-backend-1 --format '{{json .State.Health}}'
```

Liveness verifica o processo; readiness verifica também uma consulta ao banco. Ambas devem retornar HTTP 200; readiness retorna 503 quando sua consulta falha. No `inspect`, `Status` deve ser `healthy`; `Log` contém as últimas execuções e seus códigos de saída.

O health check da API roda a cada 10 segundos, permite 3 segundos por execução e tolera três falhas consecutivas após o período inicial. **Docker não reinicia automaticamente um container só porque ficou unhealthy.** Kubernetes tratará liveness e readiness de forma distinta na próxima etapa.

## 8. Verificar segurança, recursos e logs

```bash
docker compose exec backend id
docker compose exec frontend id
docker stats --no-stream
docker compose logs --tail=20 backend
curl -i http://localhost:8080/api/tasks
```

`exec` executa uma consulta dentro de um container já iniciado. Os usuários devem ser diferentes de UID 0. `stats` mostra CPU e memória; atingir o limite de memória pode causar encerramento do processo. A resposta HTTP inclui `X-Request-Id`; encontre o mesmo identificador no log JSON da API, junto com status e duração.

Logs não são métricas Prometheus. Instrumentaremos contadores e histogramas HTTP posteriormente.

## 9. Testar aplicação e persistência

```bash
docker compose --profile test run --build --rm test
bash scripts/test-persistence.sh
```

O primeiro comando executa os testes Node em um container temporário e o remove depois. Esperado: todos os testes passarem. O segundo cria sua própria tarefa, substitui o container do backend, verifica a tarefa no banco e a exclui. Esperado: mensagem de persistência confirmada.

Também pratique manualmente: crie uma tarefa no navegador, recrie apenas o backend e recarregue a página:

```bash
docker compose up -d --force-recreate --wait backend
```

A tarefa deve permanecer porque o volume existe independentemente do container. O frontend consulta a API novamente e seu proxy resolve o serviço pela rede.

## 10. Encerrar e retomar sem apagar dados

```bash
docker compose stop
docker compose up -d --wait
```

`stop` para os processos e preserva os containers. `down` também remove containers e a rede do projeto, mas preserva o volume nomeado por padrão. **`down -v` apaga o banco neste laboratório; só use com autorização explícita.**

## Confirmar o aprendizado

1. Por que a tarefa continua existindo depois de substituir o container do backend?
2. Por que a porta 3000 não precisa ser publicada para o navegador conseguir usar a API?

Em produção, manteríamos esses princípios, acrescentando TLS, autenticação, backups testados, atualizações de segurança e monitoramento. Antes de escalar escrita para várias APIs, migraremos SQLite para PostgreSQL.

## Referências oficiais

- [Instruções Dockerfile e HEALTHCHECK](https://docs.docker.com/reference/dockerfile/)
- [Perfis do Compose](https://docs.docker.com/compose/how-tos/profiles/)
- [SQLite no Node.js](https://nodejs.org/api/sqlite.html): nesta versão Node 24 usada no laboratório, o módulo pode emitir um aviso experimental ao iniciar; não ocultamos esse aviso.

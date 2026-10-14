# 04 — Imagens, containers e Compose

## O que aprender e por quê

Imagem é o pacote; container é seu processo executável. `Dockerfile` descreve o build. Compose conecta os containers por uma rede e monta um volume SQLite.

Os Dockerfiles reais estão em `backend/Dockerfile` e `frontend/Dockerfile`. Usam múltiplas etapas: Node compila TypeScript/React, e a imagem final guarda somente o necessário para executar. O frontend final usa Nginx; ambos executam sem root.

Trecho do backend:

```dockerfile
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
```

Copiar dependências antes do código preserva cache de `npm ci` quando apenas o código muda. `.dockerignore` reduz o contexto enviado ao build, excluindo arquivos locais desnecessários. Use lockfiles e tags explícitas; atualizar versões exige validar novamente.

Trecho de `compose.yaml`:

```yaml
services:
  backend:
    volumes:
      - sqlite-data:/app/data
  frontend:
    ports:
      - "127.0.0.1:8080:8080"
volumes:
  sqlite-data:
```

O backend não publica porta no host; Nginx acessa `backend:3000` pela rede interna. O arquivo `/app/data/tasks.db` fica no volume.

## Execução

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
docker compose logs --tail=20 backend frontend
docker stats --no-stream
docker compose exec backend id
docker compose --profile test run --build --rm test
```

`--build` constrói imagens; `-d` mantém processos em segundo plano; `--wait` aguarda saúde; `--rm` remove somente o container temporário de testes ao terminar. O test runner é Node.js nativo.

## Validação e dados

Abra localhost:8080 e crie uma tarefa. Para substituir o container preservando o volume:

```bash
docker compose up -d --force-recreate --wait backend
```

Confira que a tarefa permaneceu. `stop` preserva dados; `down -v` remove os volumes e não faz parte deste exercício. Volume não é backup.

Pergunta: por que o banco sobrevive à substituição do container?

Anterior: [03](03-frontend-nginx.md). Próximo: [05 — kind](05-kind-kubernetes.md).

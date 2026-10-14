# 03 — React e Nginx

## O que aprender e por quê

React executa no navegador. Depois do build, Nginx entrega HTML/JS/CSS e encaminha `/api/` para a API. Isso mantém frontend e API na mesma origem do navegador.

`frontend/src/main.tsx` chama caminhos relativos `/api/tasks`. O navegador não resolve os nomes internos `backend` ou `postgres` do Docker/Kubernetes.

Trechos de código do frontend:

```typescript
const response = await fetch(`/api${path}`, options);
// Uma criação passa por api('/tasks', ...):
await api('/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title })
});
```

O helper `api` verifica o status HTTP antes de devolver JSON. Após a criação, React recarrega a lista; dados persistentes ficam no banco, não no estado temporário da tela.

## Configuração

No Compose, `frontend/nginx.conf` usa a rede Docker. Trecho conceitual:

```nginx
location /api/ {
    proxy_pass http://backend:3000;
}
```

Sem uma URI adicional no `proxy_pass`, o caminho `/api/tasks` segue preservado. No Kubernetes, `k8s/frontend-configmap.yaml` usa um upstream nomeado apontando para o Service:

```nginx
upstream backend_api {
    server backend.infralab.svc.cluster.local:3000;
    keepalive 16;
}
# Dentro de location /api/:
proxy_pass http://backend_api;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_connect_timeout 2s;
```

Keepalive guarda até 16 conexões ociosas por worker para reutilização; não limita o total de conexões ativas. HTTP/1.1 e Connection vazio permitem essa reutilização. O Service continua selecionando Pods por conexão, portanto não espere distribuição uniforme por requisição. A mudança foi feita após erros em carga/retirada de Pods; o reteste sustentado ficou para a próxima sessão.

Ambos os arquivos também contêm tipos MIME, logs JSON e diretórios temporários compatíveis com usuário sem root.

O `try_files $uri $uri/ /index.html` entrega o HTML da aplicação para rotas de interface. `/health` valida o Nginx independentemente do banco.

## Execução e validação

Depois do capítulo 04:

```bash
docker compose exec frontend nginx -t
curl --fail -sS http://localhost:8080/health
curl --fail -sS http://localhost:8080/api/tasks
```

`nginx -t` valida sintaxe; `/health` deve retornar `ok`; `/api/tasks` confirma proxy e API. Abra o navegador e crie uma tarefa de exercício.

Em produção, configure TLS, autenticação e limites conforme o serviço; o proxy local não implementa isso automaticamente.

Pergunta: quem resolve o endereço `backend` usado pelo proxy?

Anterior: [02](02-api-sqlite.md). Próximo: [04 — Docker e Compose](04-docker-compose.md).

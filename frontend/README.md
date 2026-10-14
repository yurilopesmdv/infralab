# Frontend — React e Nginx

React apresenta tarefas e chama a API pelo mesmo endereço acessado no navegador. O build gera arquivos estáticos; Nginx entrega esses arquivos e encaminha `/api/` ao backend.

| Arquivo | Responsabilidade |
|---|---|
| [src/main.tsx](src/main.tsx) | Interface, estado local e helper de requisições HTTP |
| [src/style.css](src/style.css) | Estilos da interface |
| [index.html](index.html) | Documento de entrada do build |
| [nginx.conf](nginx.conf) | Entrega estática e proxy no Compose |
| [Dockerfile](Dockerfile) | Compila com Node e executa Nginx sem root |
| [../k8s/frontend-configmap.yaml](../k8s/frontend-configmap.yaml) | Configuração Nginx específica do Kubernetes |

## Como se conecta

O navegador executa React e usa caminhos relativos, como `/api/tasks`. No Compose, Nginx resolve `backend:3000`. No Kubernetes, o upstream `backend_api` resolve o Service `backend.infralab.svc.cluster.local:3000` e reutiliza conexões HTTP. React não resolve DNS interno do cluster e não se conecta diretamente ao PostgreSQL.

O fallback para `index.html` atende rotas da interface; `/health` verifica o Nginx. Configuração Kubernetes montada por subPath exige atualização controlada dos Pods para receber mudanças de ConfigMap. A configuração final de keepalive passou em sintaxe e testes funcionais; reteste de carga permanece pendente.

## Validação

Depois de iniciar o Compose, na raiz do projeto:

```bash
docker compose exec frontend nginx -t
curl --fail -sS http://localhost:8080/health
curl --fail -sS http://localhost:8080/api/tasks
```

No Kubernetes, use os equivalentes via kubectl e port-forward descritos no [capítulo de implantação](../guias/implementacao/06-aplicacao-kubernetes.md). Se o Pod conectado pelo port-forward for substituído, encerre o encaminhamento antigo no seu terminal e reabra-o.

Veja [React e Nginx passo a passo](../guias/implementacao/03-frontend-nginx.md). Voltar ao [projeto](../README.md).

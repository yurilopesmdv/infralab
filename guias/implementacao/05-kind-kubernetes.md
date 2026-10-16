# 05 — Cluster kind e imagens

## O que aprender e por quê

kind cria nós Kubernetes como containers Docker. Dentro do nó, containerd executa os Pods. Por isso uma imagem disponível no Docker Desktop precisa ser carregada também no nó kind.

Contexto seleciona cluster e credenciais; namespace organiza os recursos dentro do cluster. Usamos explicitamente `--context kind-infralab`.

## Execução em um laboratório novo

Consulte primeiro os clusters existentes; não recrie o atual:

```bash
kind get clusters
kubectl config get-contexts
```

Se `infralab` ainda não existir:

```bash
kind create cluster --name infralab --image kindest/node:v1.35.8
```

Construa imagens do código atual e carregue no nó:

```bash
docker build --target runtime -t infralab-backend:0.3.0 backend
docker build -t infralab-frontend:0.1.0 frontend
kind load docker-image infralab-backend:0.3.0 infralab-frontend:0.1.0 --name infralab
kubectl --context kind-infralab apply --dry-run=server -f k8s/namespace.yaml
kubectl --context kind-infralab apply -f k8s/namespace.yaml
```

Tags aqui reproduzem o laboratório. Para futuras mudanças de código, use nova versão em vez de sobrescrever a mesma tag.

## Validação

```bash
kubectl --context kind-infralab get nodes
kubectl --context kind-infralab get pods -n kube-system
kubectl --context kind-infralab get storageclass
docker exec infralab-control-plane crictl images
```

Nó deve estar Ready e componentes do sistema Running. `standard` é armazenamento local com política Delete: exclusão de PVC/cluster pode causar perda de dados. Não o exclua para solucionar problemas de aplicação.

Em produção, usamos registro de imagens e armazenamento apropriado; `imagePullPolicy: Never` e imagens carregadas manualmente são escolhas locais.

Pergunta: por que `docker images` sozinho não comprova que a imagem existe dentro do kind?

Anterior: [04](04-docker-compose.md). Próximo: [06 — Aplicação Kubernetes](06-aplicacao-kubernetes.md).

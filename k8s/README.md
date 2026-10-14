# Kubernetes — manifests e ordem de implantação

Esta pasta contém fases distintas do laboratório. Não use `kubectl apply -f k8s/` ou aplicação recursiva para executar tudo: migração, diagnóstico e configuração SQLite histórica não são a implantação atual.

| Arquivos / pasta | Papel |
|---|---|
| [namespace.yaml](namespace.yaml) | Namespace infralab |
| [backend-pvc.yaml](backend-pvc.yaml) | Armazenamento da fase SQLite, preservado |
| [legacy/](legacy/) | Referência do Deployment SQLite; não reaplicar no banco já migrado |
| [backend-deployment.yaml](backend-deployment.yaml) | API PostgreSQL, probes, recursos, RollingUpdate e preStop |
| [backend-service.yaml](backend-service.yaml) | ClusterIP que seleciona app: backend |
| [frontend-configmap.yaml](frontend-configmap.yaml) | Configuração Nginx e upstream com keepalive |
| [frontend-deployment.yaml](frontend-deployment.yaml) | React estático/Nginx com configuração montada |
| [frontend-service.yaml](frontend-service.yaml) | ClusterIP do frontend |
| [postgres-service.yaml](postgres-service.yaml) | Service headless PostgreSQL |
| [postgres-statefulset.yaml](postgres-statefulset.yaml) | postgres-0, probes e PVC próprio |
| [migrations/](migrations/) | Job SQLite → PostgreSQL, executado com origem congelada |
| [diagnostics/](diagnostics/) | Diagnóstico da tentativa original de migração |
| [metrics-server/](metrics-server/README.md) | Manifest oficial e patch local para métricas de recursos |
| [backend-hpa.yaml](backend-hpa.yaml) | Autoscaling por CPU, de duas a dez APIs |
| [load-job.yaml](load-job.yaml) | Job finito de leituras, usando script montado de ConfigMap |

## Ordem num laboratório novo

1. Criar/verificar kind, carregar imagens e aplicar Namespace.
2. Para PostgreSQL direto: criar Secret fora do Git, Service e StatefulSet; aguardar banco pronto. Para repetir a aula SQLite, seguir o caminho histórico explicado nos guias.
3. Se houver dados SQLite: congelar escritores, migrar por Job, conferir e só depois trocar a API. Não existe migração a executar num banco novo sem origem.
4. Aplicar Deployment e Service backend; depois ConfigMap, Deployment e Service frontend.
5. Validar probes, endpoints e fluxo HTTP por port-forward.
6. Instalar Metrics Server, aplicar HPA e executar carga somente após conferir recursos e dados.

O HPA controla replicas, por isso o Deployment atual omite esse campo. Imagens locais usam política Never; carregue-as no kind antes de iniciar Pods. A exceção TLS do Metrics Server é exclusiva do laboratório e está explicada em seu README.

## Consultar sem alterar

```bash
kubectl --context kind-infralab get deployments,statefulsets,services,pvc,hpa -n infralab
kubectl --context kind-infralab get pods -n infralab
kubectl --context kind-infralab describe hpa/backend -n infralab
```

Os guias mostram aplicação com dry-run, resultados esperados e investigação. Comece por [kind](../guias/implementacao/05-kind-kubernetes.md) e [implantação](../guias/implementacao/06-aplicacao-kubernetes.md). Tipos de recursos estão no [glossário](../guias/implementacao/00-visao-geral-e-glossario.md). Voltar ao [projeto](../README.md).

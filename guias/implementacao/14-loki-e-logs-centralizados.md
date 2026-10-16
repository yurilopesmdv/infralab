# 14 — Loki, Alloy e correlação de logs

Anterior: [13 — Gerar dados e criar gráficos](13-gerar-dados-e-criar-graficos.md). Pré-requisitos: API, Nginx, Prometheus e Grafana prontos no namespace infralab.

## O que aprender e por quê

Métricas mostram tendências; logs registram eventos. Um gráfico pode mostrar aumento de respostas 5xx, mas o log da requisição ajuda a localizar o serviço, caminho e erro. Centralização evita procurar manualmente em cada Pod, especialmente quando o HPA muda a quantidade de réplicas.

```text
API / Nginx → stdout e stderr dos containers
                       ↓ API Kubernetes de logs
                 Grafana Alloy
                       ↓ push HTTP
                 Loki → PVC local
                       ↑ LogQL
                    Grafana
```

Loki armazena logs e indexa labels. Alloy descobre containers e envia suas linhas. Grafana consulta Loki; Prometheus continua coletando métricas, sem receber logs.

## 1. Contrato JSON e request ID

API registra requestId, método, caminho, status e duração. A resposta inclui X-Request-Id, criado pela API. Nginx registra esse cabeçalho de resposta usando `$upstream_http_x_request_id`:

```nginx
log_format json escape=json '{"method":"$request_method","path":"$uri","status":$status,"durationSeconds":$request_time,"requestId":"$upstream_http_x_request_id"}';
```

Uma requisição encaminhada à API passa a ter o mesmo ID nos dois logs. Requisições estáticas sem upstream ou falhas antes da API podem ter ID vazio. Isso não é tracing distribuído: não há spans, parent IDs ou coleta de traces.

O formato inclui campos explícitos e não registra Authorization, cookies, corpo JSON ou query string. Os paths da API ainda podem conter IDs; logs precisam de controle de acesso e retenção, mesmo sem esses cabeçalhos.

## 2. Escolha do coletor e permissões

[config.alloy](../../k8s/observability/config.alloy) usa discovery.kubernetes para descobrir Pods. discovery.relabel filtra app=backend ou app=frontend e define namespace, app, pod e container como labels. loki.source.kubernetes lê os logs pela API; loki.write envia ao Service Loki.

```alloy
loki.source.kubernetes "apps" {
  targets    = discovery.relabel.apps.output
  forward_to = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

Uma Role permite somente get/list/watch de Pods e get de pods/log no namespace infralab. O coletor não lê Secrets, não administra Deployments, não monta disco do nó e não executa como root. Um Deployment de uma réplica evita duplicar a coleta; não usamos DaemonSet neste laboratório.

Esse modo simplifica o ambiente, mas aumenta tráfego pela API/kubelets. Grandes instalações precisam dimensionar coleta e podem preferir agentes lendo arquivos por nó. O estado do coletor usa emptyDir: reconexões/reinícios podem reler linhas ou perder janelas não disponíveis mais no Kubernetes. Não prometemos entrega exatamente uma vez nem replay completo de logs já rotacionados.

## 3. Labels e consultas

requestId permanece no JSON, não no índice. Cada ID como label criaria uma série por requisição. Namespace/app/container e Pod identificam streams do laboratório; com muitos Pods/reinícios, reavalie cardinalidade e uso de metadados estruturados para nome de Pod.

LogQL primeiro seleciona streams por labels, depois filtra ou interpreta suas linhas. `| json` extrai campos na consulta; isso não transforma requestId em label persistente de ingestão.

## 4. Armazenamento e retenção

[loki.yml](../../k8s/observability/loki.yml) usa TSDB com schema v13, filesystem local e uma réplica. Índices, chunks e WAL usam o PVC loki-data de 2Gi. Compactor tem retenção habilitada e período de 48 horas. A exclusão é assíncrona; retenção temporal não é limite rígido de espaço.

Loki executa como UID 10001, com fsGroup, probes e recursos. Alloy executa como UID 473. Os Services permanecem internos e Loki está em modo sem autenticação, próprio deste laboratório. Produção exige controle de acesso, TLS, armazenamento/dimensionamento e estratégia de disponibilidade apropriados. PVC não substitui backup e não protege contra excluir o cluster kind.

## 5. Construir, validar e implantar

Na raiz do projeto, no Ubuntu WSL:

```bash
docker pull --platform linux/amd64 grafana/loki:3.7.8
docker pull --platform linux/amd64 grafana/alloy:v1.20.1
docker run --rm -v "$PWD/k8s/observability/loki.yml:/config/loki.yml:ro" grafana/loki:3.7.8 -config.file=/config/loki.yml -verify-config=true
docker run --rm -v "$PWD/k8s/observability/config.alloy:/config/config.alloy:ro" grafana/alloy:v1.20.1 validate /config/config.alloy
```

Os binários oficiais conferem a configuração antes de aplicá-la. Carregue as imagens da arquitetura do nosso nó:

```bash
docker image save --platform linux/amd64 -o /tmp/infralab-loki.tar grafana/loki:3.7.8
kind load image-archive /tmp/infralab-loki.tar --name infralab
docker image save --platform linux/amd64 -o /tmp/infralab-alloy.tar grafana/alloy:v1.20.1
kind load image-archive /tmp/infralab-alloy.tar --name infralab
kubectl --context kind-infralab apply --dry-run=server -k k8s/observability
kubectl --context kind-infralab apply -k k8s/observability
kubectl --context kind-infralab apply -f k8s/frontend-configmap.yaml
kubectl --context kind-infralab rollout restart deployment/frontend -n infralab
```

O frontend usa subPath para nginx.conf; o restart aplica o novo formato de log. Nenhuma migração ou alteração de dados do banco é necessária. ConfigMaps de Loki/Alloy/Grafana usam hash pelo Kustomize; alterações de configuração atualizam os templates. O arquivo fonte do Nginx Compose também tem o campo requestId; para usá-lo no Compose, reconstrua seu frontend em uma etapa própria.

## 6. Validar a coleta de ponta a ponta

```bash
kubectl --context kind-infralab rollout status deployment/loki -n infralab --timeout=180s
kubectl --context kind-infralab rollout status deployment/alloy -n infralab --timeout=120s
kubectl --context kind-infralab rollout status deployment/frontend -n infralab --timeout=120s
kubectl --context kind-infralab get pods,pvc -n infralab
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- node --input-type=module < scripts/verify-logs.mjs
```

O teste Node consulta readiness do Loki e executa GET /api/tasks pelo frontend. Depois procura o request ID devolvido nos logs dos dois serviços, aguardando até um minuto pela entrega. Também confere que requestId não está nos labels do stream e que um cabeçalho fictício de Authorization não foi registrado. Não cria nem remove tarefas.

Se houver erro, leia logs de deployment/alloy e deployment/loki, confira RBAC e targets antes de mudar recursos. Alloy pronto não comprova que Loki recebeu uma linha; a consulta de ponta a ponta comprova esse caminho.

## 7. Consultar no Grafana

Reabra o port-forward se o Pod do Grafana tiver sido substituído:

```bash
kubectl --context kind-infralab port-forward -n infralab service/grafana 3002:3000
```

Em http://localhost:3002, abra **Explore**, escolha a fonte **Loki** e o modo **Code**. Selecione últimos 15 minutos e execute:

```logql
{namespace="infralab",app="backend"}
```

Somente respostas API 4xx/5xx, depois de interpretar JSON:

```logql
{namespace="infralab",app="backend"} | json | __error__="" | status >= 400
```

Para juntar os registros de uma requisição entre serviços, substitua o ID pelo valor impresso pelo teste:

```logql
{namespace="infralab",app=~"backend|frontend"} | json | requestId="SEU_REQUEST_ID"
```

Também é possível filtrar a linha diretamente com `|= "SEU_REQUEST_ID"`. O campo derivado RequestID oferece um link **Buscar request ID** nos detalhes de linhas compatíveis. O dashboard inicial inclui um painel de logs junto aos indicadores HTTP; use Explore para consultas detalhadas.

## Aprendizado

Por que request ID é útil no JSON, mas ruim como label de índice? Por que uma requisição pode ter dois registros com o mesmo ID sem ser uma duplicação indevida?

Referências: [coleta Kubernetes pelo Alloy](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.kubernetes/) e [armazenamento TSDB](https://grafana.com/docs/loki/latest/operations/storage/tsdb/).

Voltar ao [índice](README.md).

# 11 — Métricas HTTP e Prometheus

Anterior: [10 — Diagnóstico](10-diagnostico-observabilidade.md). Este capítulo parte da API PostgreSQL, HPA e carga moderada já validados.

## O que aprender e por quê

Uma probe responde se o processo pode operar agora. Um log descreve um evento. Uma métrica registra um valor ao longo do tempo. Prometheus consulta endpoints de métricas periodicamente e guarda séries temporais para investigar tráfego, erros, latência e consumo.

A coleta usa pull: Prometheus busca dados da API a cada 15 segundos. Um scrape produz amostras com nome, labels, valor e instante. Um target é um endereço coletado. O conjunto desses targets forma um job de coleta; esse job não é o recurso Kubernetes Job usado para migração/carga.

```text
Pod API-A:3000/metrics ← Prometheus → PVC de séries temporais
Pod API-B:3000/metrics ←      ↑
                     descoberta dos Pods pela API Kubernetes
                              ↑ consultas PromQL
                           Grafana
```

Metrics Server continua fornecendo CPU/memória ao HPA. Prometheus não o substitui, nem muda automaticamente a fonte de métricas do HPA. Nosso dashboard também não instala kube-state-metrics: o painel de coleta mostra targets UP, não a quantidade desejada do Deployment.

## Tipos de métricas e cardinalidade

| Tipo | Significado | Exemplo |
|---|---|---|
| Counter | Acumula eventos e reinicia com o processo | Requisições concluídas |
| Gauge | Valor instantâneo que sobe ou desce | Memória residente do processo |
| Histogram | Distribui observações por limites de buckets, com soma e contagem | Duração das respostas |
| Summary | Calcula quantis no cliente; não é usado aqui | Útil em outros cenários, mas seus quantis não se agregam diretamente entre réplicas |

Cada combinação de labels cria uma série. Use método, rota normalizada e status. `/api/tasks/123` e `/api/tasks/456` viram `/api/tasks/:id`. Request ID, título, usuário e URL arbitrária não viram labels: causariam cardinalidade crescente e poderiam expor dados.

## 1. Instrumentação da API

[backend/src/metrics.ts](../../backend/src/metrics.ts) usa `@prometheus-io/client`, o cliente oficial Node.js. Registry reúne métricas; Counter conta respostas e Histogram observa duração em segundos. O handler chama a observação no evento `finish` da resposta.

```typescript
requests.inc({ method, route, status_code: String(status) });
duration.observe({ method, route, status_code: String(status) }, seconds);
```

O código completo limita rotas e métodos e exclui probes e `/metrics` dos indicadores HTTP. A coleta não deve inflar o tráfego de negócio. Métricas padrão incluem memória, CPU e informações do runtime Node.

`/metrics` responde texto Prometheus; `/api/health/live` e `/api/health/ready` continuam JSON e mantêm suas funções. O endpoint de métricas é acessado diretamente por Prometheus, não pelo proxy público do frontend. Credenciais PostgreSQL não são exportadas.

Essas métricas medem respostas concluídas da API. Não incluem requisições abortadas antes de `finish`, nem erros gerados somente pelo Nginx, como 502 antes de chegar à API. Para esses casos, correlacione logs Nginx/request ID e, em uma etapa posterior, instrumente a camada de entrada.

## 2. Construir e carregar a API

Na raiz do projeto, no Ubuntu WSL:

```bash
bash scripts/test-postgres.sh
docker build --target runtime -t infralab-backend:0.3.0 backend
kind load docker-image infralab-backend:0.3.0 --name infralab
kubectl --context kind-infralab apply --dry-run=server -f k8s/backend-deployment.yaml
kubectl --context kind-infralab apply -f k8s/backend-deployment.yaml
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
```

O teste é isolado, preserva o banco do cluster e inclui validação de labels e formato HTTP. A nova imagem mantém o contrato e o banco PostgreSQL; não executa migração de dados.

## 3. Descoberta e permissões

Não colete apenas `backend:3000`: o Service pode entregar uma réplica diferente a cada conexão, misturando contadores de processos diferentes. [prometheus.yml](../../k8s/observability/prometheus.yml) descobre Pods e filtra namespace infralab, label app=backend, porta http e condição Ready.

```yaml
kubernetes_sd_configs:
  - role: pod
    namespaces:
      names: [infralab]
```

`relabel_configs` filtra metadados de descoberta e acrescenta pod/namespace. A label `instance` distingue o endereço de cada target. Uma Role permite get/list/watch somente de Pods no namespace, e RoleBinding associa essa permissão ao ServiceAccount Prometheus. Não precisa ler Secrets nem administrar o cluster.

## 4. Instalar Prometheus e Grafana

Prepare o Secret do Grafana conforme o [capítulo 12](12-grafana.md) antes de aplicar a stack; o Deployment depende dele. Os manifests completos estão em [k8s/observability/](../../k8s/observability/README.md).

```bash
docker pull prom/prometheus:v3.15.0
docker pull grafana/grafana:13.2.4
kind load docker-image prom/prometheus:v3.15.0 grafana/grafana:13.2.4 --name infralab
kubectl --context kind-infralab apply --dry-run=server -k k8s/observability
kubectl --context kind-infralab apply -k k8s/observability
```

Se a importação informar digest ausente, exporte somente a arquitetura do nó. Para nosso x86_64:

```bash
docker image save --platform linux/amd64 -o /tmp/infralab-prometheus.tar prom/prometheus:v3.15.0
kind load image-archive /tmp/infralab-prometheus.tar --name infralab
docker image save --platform linux/amd64 -o /tmp/infralab-grafana.tar grafana/grafana:13.2.4
kind load image-archive /tmp/infralab-grafana.tar --name infralab
```

`-k` renderiza recursos/ConfigMaps com Kustomize. Prometheus guarda séries em PVC, com dois dias de retenção e limite de 1GB para blocos. O PVC de 2Gi também precisa acomodar WAL e dados recentes: retenção não é quota rígida de todo o diretório. Grafana usa outro PVC. Não alteram os volumes da aplicação.

## 5. Validar e consultar

```bash
kubectl --context kind-infralab get pods,pvc -n infralab
kubectl --context kind-infralab logs deployment/prometheus -n infralab --tail=30
kubectl --context kind-infralab port-forward -n infralab service/prometheus 9090:9090
```

Abra http://localhost:9090 e consulte a página Targets. Espere duas APIs UP e o próprio Prometheus UP. Aguarde pelo menos duas coletas para usar rate. O port-forward mantém o terminal ocupado e termina com Ctrl+C.

PromQL para estudar na interface:

```promql
# Estado da coleta: 1 = sucesso; 0 = falha de scrape
up{job="infralab-api"}

# Taxa total por segundo; rate trata resets dos contadores
sum(rate(infralab_http_requests_total{job="infralab-api"}[2m]))

# Tráfego por rota, sem IDs individuais
sum by (route) (rate(infralab_http_requests_total{job="infralab-api"}[2m]))

# Percentil 95 agregado entre réplicas
histogram_quantile(0.95,
  sum by (le) (rate(infralab_http_request_duration_seconds_bucket{job="infralab-api"}[2m])))
```

`[2m]` é uma janela de dois minutos; `rate` estima incremento por segundo. `le` é o limite superior do bucket. Preserve `le` na soma para calcular o quantil do histograma agregado; não faça média de p95 de réplicas.

Nosso menor bucket é 5 ms: o p95 Prometheus é uma estimativa por interpolação e pode diferir do gerador de carga, que usa buckets de 1 ms. Ajustar buckets deve seguir a faixa de latência que interessa medir.

## 6. Carga e regras locais

```bash
kubectl --context kind-infralab create configmap load-http-script -n infralab --from-file=scripts/load-http.mjs --dry-run=client -o yaml | kubectl --context kind-infralab apply -f -
kubectl --context kind-infralab create -f k8s/load-job.yaml
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- node --input-type=module < scripts/verify-observability.mjs
```

O gerador faz somente leituras. Veja logs do nome retornado pelo create e confirme Complete. Com janela de dois minutos e carga de um minuto, a taxa no gráfico depende do trecho da janela observado; não precisa coincidir exatamente com o relatório do gerador.

[alerts.yml](../../k8s/observability/alerts.yml) define ausência de coleta por um minuto e proporção 5xx acima de 5% por dois minutos, com tráfego superior a 1 req/s. Esses limiares são exemplos locais, não SLOs de produção. Alertas passam de inactive para pending e firing conforme expressão e duração `for`. Sem Alertmanager, não enviam notificações. O alerta de ausência total também cobre desaparecimento de todos os targets Ready; não detecta individualmente cada Pod não pronto.

## Aprendizado e produção

Prometheus local tem uma réplica e armazenamento do kind; não há alta disponibilidade ou retenção externa. Produção exige capacidade, acesso autenticado/TLS, backups e estratégia de retenção apropriados. O endpoint e Prometheus ficam internos; não exponha suas portas publicamente como substituição desses controles.

Perguntas: por que coletar diretamente os Pods em vez de apenas o Service? Por que request ID pertence aos logs e não aos labels?

Referências: [cliente Node oficial](https://github.com/prometheus/client_js), [descoberta Kubernetes](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config), [histogramas](https://prometheus.io/docs/practices/histograms/).

Próximo: [12 — Grafana](12-grafana.md).

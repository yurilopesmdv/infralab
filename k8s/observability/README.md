# Observabilidade no Kubernetes

Prometheus coleta cada Pod Ready da API; Grafana consulta Prometheus e carrega o dashboard InfraLab automaticamente. Instalação usa Kustomize embutido no kubectl, sem Operator ou Helm.

| Arquivo | Responsabilidade |
|---|---|
| [kustomization.yaml](kustomization.yaml) | Reúne recursos e gera ConfigMaps com hash |
| [prometheus.yaml](prometheus.yaml) | ServiceAccount, permissões de Pods no namespace, PVC, Service e Deployment |
| [prometheus.yml](prometheus.yml) | Descoberta por Pod, filtros e intervalo de coleta |
| [alerts.yml](alerts.yml) | Regras locais de ausência de coleta e respostas 5xx |
| [grafana.yaml](grafana.yaml) | Deployment, PVC, Service e referência ao Secret |
| [datasources.yaml](datasources.yaml) | Conecta Grafana aos Services Prometheus e Loki |
| [dashboards.yaml](dashboards.yaml) | Configura carregamento de dashboards por arquivo |
| [infralab.json](infralab.json) | Dez painéis: HTTP, processos Node.js e logs |
| [demo-job.yaml](demo-job.yaml) | Leituras por cinco minutos, executadas somente via create explícito |

## Execução

Prepare primeiro API 0.3.0 e Secret grafana-admin, seguindo os guias. Depois:

```bash
kubectl --context kind-infralab apply --dry-run=server -k k8s/observability
kubectl --context kind-infralab apply -k k8s/observability
kubectl --context kind-infralab rollout status deployment/prometheus -n infralab --timeout=120s
kubectl --context kind-infralab rollout status deployment/grafana -n infralab --timeout=180s
```

Prometheus usa imagem `prom/prometheus:v3.15.0`, usuário 65534, PVC 2Gi e retenção de dois dias ou 1GB de blocos. Grafana usa `grafana/grafana:13.2.4`, usuário 472 e PVC 1Gi. Ambos têm probes e limites. Recreate evita duas instâncias escrevendo no mesmo PVC durante atualizações.

O Prometheus lê somente Pods do namespace infralab; a API não recebe permissões Kubernetes adicionais. Grafana não monta token de ServiceAccount. ConfigMaps geradas mudam de nome quando os arquivos mudam, atualizando o template dos Deployments em um novo apply. ConfigMaps antigas não são removidas automaticamente.

Os Services são internos. Acesso local usa port-forward, sem exposição pública. Prometheus não tem autenticação nesta configuração; produção exige controle de acesso, TLS e armazenamento dimensionado. Retenção não substitui backup. Alertas são avaliados localmente, sem Alertmanager ou notificações externas.

Estude em ordem: [11 — Prometheus](../../guias/implementacao/11-prometheus.md), [12 — Grafana](../../guias/implementacao/12-grafana.md). Voltar ao [Kubernetes](../README.md).

## Loki e Alloy

`loki.yaml` define PVC 2Gi, Service e Deployment non-root; `loki.yml` configura TSDB/filesystem e retenção assíncrona de 48 horas. `alloy.yaml` define ServiceAccount, Role limitada ao namespace e Deployment non-root; `config.alloy` descobre Pods backend/frontend, lê seus logs pela API Kubernetes e envia ao Loki. Não monta diretórios do host. Retenção não é uma quota rígida de disco; dimensione o volume conforme a ingestão.

Valide `rollout status deployment/loki` e `rollout status deployment/alloy` no namespace infralab. As imagens fixadas são `grafana/loki:3.7.8` e `grafana/alloy:v1.20.1`. Prepare as imagens e a configuração Nginx conforme [14 — Logs centralizados](../../guias/implementacao/14-loki-e-logs-centralizados.md), antes de aplicar esta stack.

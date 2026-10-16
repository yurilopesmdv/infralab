# Observabilidade — arquitetura e validação

## Implementação atual

API 0.3.0 expõe `/metrics` com o cliente oficial `@prometheus-io/client` 0.16.1. Contador HTTP e histograma de duração usam método, rota normalizada e status; probes e scrapes ficam fora das métricas HTTP. Métricas padrão do processo Node complementam o diagnóstico. Logs JSON e request ID continuam presentes.

Prometheus 3.15.0 descobre Pods Ready da API no namespace infralab, coleta a cada 15 segundos e mantém séries em PVC 2Gi. Retenção: dois dias ou 1GB de blocos, além de espaço necessário para WAL/dados recentes. RBAC permite somente leitura de Pods no namespace. Não coleta por um único endereço balanceado do Service.

Grafana 13.2.4 usa PVC 1Gi, autenticação administrativa via Secret e provisionamento de fonte/dashboard por ConfigMaps. Dashboard InfraLab tem oito painéis: tráfego, proporção 5xx, p95, targets UP, tráfego por Pod, status HTTP, memória e CPU do processo. Ambos os processos executam sem root e têm recursos/probes configurados.

O Metrics Server continua responsável pelas métricas usadas no HPA. Prometheus não modifica seu funcionamento. Grafana usa seu próprio SQLite interno para configuração; o banco de tarefas permanece PostgreSQL, separado.

## Validação em 16/10/2026

- Quinze testes isolados Node passaram: HTTP, métricas, migração, SQLite e PostgreSQL.
- Quatro testes HTTP passaram no cluster com a imagem instrumentada.
- `promtool` validou configuração e as duas regras locais.
- Prometheus descobriu duas APIs UP e coletou seu próprio endpoint.
- Quatro verificações Node confirmaram descoberta, amostras HTTP, regras e saúde Grafana.
- A fonte Grafana consultou Prometheus com sucesso; API de provisionamento confirmou o dashboard com oito painéis. As oito consultas retornaram resultados válidos.
- Job `load-http-tmd9b`: 11.797 leituras em 60 segundos, zero erros, 196,61 operações/s e p95 de 2 ms. Isso valida somente a carga moderada medida.
- Novos PVCs Prometheus/Grafana Bound; volumes SQLite/PostgreSQL preservados.

## Acesso e estudo

```bash
kubectl --context kind-infralab port-forward -n infralab service/prometheus 9090:9090
```

Em outro terminal:

```bash
kubectl --context kind-infralab port-forward -n infralab service/grafana 3002:3000
```

Prometheus: http://localhost:9090. Grafana: http://localhost:3002, usuário admin, senha privada no arquivo `.secrets/grafana-admin-password`. Abra a pasta InfraLab em Dashboards. O arquivo de senha é ignorado pelo Git.

Aprenda os conceitos e reproduza todos os passos em [11 — Prometheus](../guias/implementacao/11-prometheus.md) e [12 — Grafana](../guias/implementacao/12-grafana.md). Recursos completos em [k8s/observability/](../k8s/observability/README.md).

## Limites

Coleta, dashboard e avaliação de alertas são locais; não há Alertmanager, notificações, Loki, tracing ou alta disponibilidade. Retenção de métricas não substitui backup. Services/port-forward não são exposição pública de produção. CPU/memória do processo não são exatamente as métricas de container do Metrics Server. HTTP 502 do Nginx antes de chegar à API e requisições abortadas não entram nos contadores de respostas concluídas da API.

Referências: [cliente Node](https://github.com/prometheus/client_js), [configuração Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [provisionamento Grafana](https://grafana.com/docs/grafana/latest/administration/provisioning/).

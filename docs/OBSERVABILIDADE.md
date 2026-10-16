# Observabilidade — arquitetura e validação

## Implementação atual

API 0.3.0 expõe `/metrics` com o cliente oficial `@prometheus-io/client` 0.16.1. Contador HTTP e histograma de duração usam método, rota normalizada e status; probes e scrapes ficam fora das métricas HTTP. Métricas padrão do processo Node complementam o diagnóstico. Logs JSON e request ID continuam presentes.

Prometheus 3.15.0 descobre Pods Ready da API no namespace infralab, coleta a cada 15 segundos e mantém séries em PVC 2Gi. Retenção: dois dias ou 1GB de blocos, além de espaço necessário para WAL/dados recentes. RBAC permite somente leitura de Pods no namespace. Não coleta por um único endereço balanceado do Service.

Grafana 13.2.4 usa PVC 1Gi, autenticação administrativa via Secret e provisionamento de fonte/dashboard por ConfigMaps. Dashboard InfraLab tem dez painéis, incluindo logs Loki e os indicadores: respostas acumuladas, tráfego, proporção 5xx, p95, targets UP, tráfego por Pod, status HTTP, memória e CPU do processo. Ambos os processos executam sem root e têm recursos/probes configurados.

O Metrics Server continua responsável pelas métricas usadas no HPA. Prometheus não modifica seu funcionamento. Grafana usa seu próprio SQLite interno para configuração; o banco de tarefas permanece PostgreSQL, separado.

## Validação em 16/10/2026

- Quinze testes isolados Node passaram: HTTP, métricas, migração, SQLite e PostgreSQL.
- Quatro testes HTTP passaram no cluster com a imagem instrumentada.
- `promtool` validou configuração e as duas regras locais.
- Prometheus descobriu duas APIs UP e coletou seu próprio endpoint.
- Quatro verificações Node confirmaram descoberta, amostras HTTP, regras e saúde Grafana.
- A fonte Grafana consultou Prometheus com sucesso; API de provisionamento confirmou inicialmente o dashboard com oito painéis, depois ampliado para nove. As oito consultas retornaram resultados válidos.
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

Coleta, dashboard e avaliação de alertas são locais; Loki/Alloy centralizam logs; não há Alertmanager, notificações, tracing ou alta disponibilidade. Retenção de métricas não substitui backup. Services/port-forward não são exposição pública de produção. CPU/memória do processo não são exatamente as métricas de container do Metrics Server. HTTP 502 do Nginx antes de chegar à API e requisições abortadas não entram nos contadores de respostas concluídas da API.

Referências: [cliente Node](https://github.com/prometheus/client_js), [configuração Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [provisionamento Grafana](https://grafana.com/docs/grafana/latest/administration/provisioning/).

## Demonstração e navegação

O dashboard atual tem dez painéis, incluindo respostas acumuladas dos processos atuais, e abre na página inicial com janela de 30 minutos. A carga demo é iniciada explicitamente com `kubectl create -f k8s/observability/demo-job.yaml --context kind-infralab`; não roda junto do apply da stack. Dura cinco minutos com alvo de 200 operações/s e não altera tarefas. Estude [o capítulo 13](../guias/implementacao/13-gerar-dados-e-criar-graficos.md) para executar a demonstração e construir um gráfico próprio.

Validação da demonstração de cinco minutos: Job `observability-demo-l8t4f` terminou Complete, com 58.951 leituras em 300 segundos, zero erros, taxa de 196,5 operações/s e percentis p50 1 ms, p95 2 ms e p99 3 ms. As nove consultas e a página inicial do Grafana foram verificadas; a carga não alterou tarefas.

## Logs centralizados

Loki 3.7.8 persiste logs em PVC 2Gi com retenção assíncrona de 48 horas. Alloy 1.20.1 lê logs de Pods backend/frontend pela API Kubernetes com permissões restritas ao namespace, sem montagem do host. Labels são namespace, app, pod e container; request ID permanece no JSON para evitar cardinalidade elevada. Grafana consulta Loki por Service interno, com painel de logs e busca por request ID.

Dois testes em `scripts/verify-logs.mjs` validaram readiness e a mesma requisição nos logs Nginx/API, sem registrar o cabeçalho Authorization de teste. Quinze testes isolados, quatro HTTP e quatro de métricas passaram. A coleta não oferece entrega exatamente uma vez; rotação dos logs e indisponibilidade prolongada podem causar perda. PVC local não é backup nem alta disponibilidade. Implementação e consultas estão no [capítulo 14](../guias/implementacao/14-loki-e-logs-centralizados.md).

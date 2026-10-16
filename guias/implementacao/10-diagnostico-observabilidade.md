# 10 — Diagnóstico e ponte para observabilidade

## O que aprender e por quê

Verificar estado mostra sintomas. Logs e métricas ajudam a explicar causas. Comece pelo caminho da requisição: navegador → Nginx → Service → API → PostgreSQL.

## Execução

```bash
kubectl --context kind-infralab get deployments,statefulsets,services,pvc,hpa -n infralab
kubectl --context kind-infralab get pods -n infralab
kubectl --context kind-infralab describe pods -n infralab -l app=backend
kubectl --context kind-infralab logs deployment/backend -n infralab --tail=30
kubectl --context kind-infralab logs deployment/frontend -n infralab --tail=30
kubectl --context kind-infralab top pods -n infralab
kubectl --context kind-infralab describe hpa/backend -n infralab
```

| Sintoma | Primeira investigação |
|---|---|
| localhost:8081 recusa conexão | Terminal port-forward encerrado ou porta incorreta |
| Nginx 502 | Service, endpoints Ready, endereço e porta upstream |
| Probe connection refused | Processo e porta do container |
| Readiness 503 | Banco, Secret, DNS e conexão |
| Pod Pending | Eventos, requests, nó e PVC |
| OOMKilled | Memória medida e limit |
| HPA unknown | Metrics Server, `top`, requests e eventos HPA |
| Job Error | Logs do Job e causa antes de repetir |

`kubectl logs deployment/backend` consulta um Pod, não agrega automaticamente todos. Para um reinício, use `kubectl logs POD --previous -n infralab`. Jobs antigos Failed preservados para diagnóstico não significam que a aplicação atual esteja indisponível.

## Conexão com os capítulos de observabilidade

API já produz logs JSON com request ID, método, rota, status e duração. Nginx também produz logs JSON. Prometheus usa `/metrics` para contadores HTTP e histogramas de latência, sem labels de alta cardinalidade como ID de tarefa ou request ID.

Grafana mostra dashboards; centralização de logs com Loki continua futura. `/api/health/ready` permanece uma probe, não endpoint Prometheus. Siga [11 — Prometheus](11-prometheus.md) e [12 — Grafana](12-grafana.md) para implementar e estudar a coleta.

Pergunta: por que request ID ajuda nos logs, mas é uma escolha ruim de label para uma métrica?

Anterior: [09](09-carga-hpa.md). Voltar ao [índice](README.md).

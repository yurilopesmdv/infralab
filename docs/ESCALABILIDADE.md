# Escalabilidade da API

## Estado validado

API PostgreSQL 0.2.1 com duas réplicas Ready, dois endpoints prontos no Service backend e três testes HTTP de frontend/saúde/CRUD aprovados. Dez réplicas, carga e HPA continuam pendentes.

As duas APIs acessam o mesmo PostgreSQL pelo Service `postgres`. O Service backend seleciona Pods Ready com label `app: backend`. Conexões persistentes podem continuar no mesmo Pod; não assumir distribuição uniforme por requisição.

Todos os Pods estão no único nó kind. Aumentar réplicas aqui não adiciona computadores, capacidade física ou alta disponibilidade entre nós. PostgreSQL continua com uma réplica.

## Mudança e comandos

Em `k8s/backend-deployment.yaml`:

```yaml
spec:
  replicas: 2
```

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/backend-deployment.yaml
kubectl --context kind-infralab apply -f k8s/backend-deployment.yaml
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=60s
kubectl --context kind-infralab get deployment/backend -n infralab
kubectl --context kind-infralab get endpointslices -n infralab -l kubernetes.io/service-name=backend
```

Dry-run valida sem persistir. Apply muda a quantidade desejada; o controlador cria o Pod adicional. Rollout aguarda disponibilidade. Resultado: Deployment `2/2` e dois destinos prontos no EndpointSlice.

Teste funcional sem Node no host:

```bash
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- env BASE_URL=http://frontend:8080 EXPECTED_DATABASE=postgres node --input-type=module < backend/tests/app.test.mjs
```

`-i` envia o arquivo pela entrada padrão. As variáveis selecionam frontend e banco esperado. Os testes criam/excluem somente sua tarefa temporária. Três testes passaram; isso não comprova throughput máximo.

## Recursos e próximos passos

Cada API solicita 150m CPU e 64Mi memória, com limites de 500m e 256Mi. Duas réplicas somam requests de 300m e 128Mi; esses valores não representam consumo real.

O pool permite até cinco conexões por processo: duas APIs podem abrir dez; dez APIs podem abrir cinquenta, fora outros clientes. `SHOW max_connections` retornou 100 no PostgreSQL. Precisamos medir CPU, memória, consultas e latência antes de concluir a capacidade.

A API `v1beta1.metrics.k8s.io` não existe neste cluster. A próxima preparação do HPA por CPU exige métricas de recursos, normalmente via Metrics Server. Isso é separado da etapa Prometheus. Referência: [HPA oficial](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).

Sequência acordada: carga controlada e escala gradual até dez, Metrics Server/HPA, depois `guias/implementacao/` em Markdown numerado com comandos, código/YAML e ligações entre Docker/Nginx/API/banco/Kubernetes; só então Prometheus/Grafana.

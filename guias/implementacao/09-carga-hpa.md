# 09 — Escala, carga limitada e HPA

HPA/escala até dez validados. Em 16/10/2026, duas execuções de 60 segundos com alvo de 200 operações/s passaram com zero erros, em estado estável e durante RollingUpdate. Esta validação é limitada à carga moderada do laboratório; resultados e procedimentos estão em [docs/ESCALABILIDADE.md](../../docs/ESCALABILIDADE.md).

## O que aprender e por quê

Escala horizontal aumenta Pods de API, mantendo PostgreSQL compartilhado. HPA ajusta réplicas por uma métrica. Metrics Server fornece CPU/memória recentes; não substitui Prometheus.

Requests de CPU são a base da porcentagem: `150m` equivale a 0,15 CPU. Alvo 60% significa aproximadamente 90m por API, não 60% do nó nem do limit de 500m. A regra aproximada é `ceil(réplicas atuais × utilização atual / alvo)`, sujeita a tolerância, métricas ausentes e estabilização.

## Escala manual antes de instalar HPA

```bash
kubectl --context kind-infralab scale deployment/backend --replicas=5 -n infralab
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
kubectl --context kind-infralab scale deployment/backend --replicas=10 -n infralab
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
kubectl --context kind-infralab get pods -n infralab -l app=backend
```

Esperado: 10/10 Ready. Dez APIs podem abrir 50 conexões; RollingUpdate com `maxSurge: 1` permite 55. Reserve conexões administrativas, migrações e outros clientes. Todos os Pods continuam no mesmo nó local.

## Metrics Server e HPA

```bash
kubectl --context kind-infralab apply -k k8s/metrics-server
kubectl --context kind-infralab rollout status deployment/metrics-server -n kube-system --timeout=120s
kubectl --context kind-infralab top pods -n infralab
kubectl --context kind-infralab apply --dry-run=server -f k8s/backend-hpa.yaml
kubectl --context kind-infralab apply -f k8s/backend-hpa.yaml
kubectl --context kind-infralab get hpa -n infralab
```

O patch Metrics Server desativa validação de certificado kubelet somente para kind. Consulte [as limitações](../../k8s/metrics-server/README.md) antes de usar em outro ambiente.

Trecho de `k8s/backend-hpa.yaml`:

```yaml
minReplicas: 2
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

O Deployment atual omite `spec.replicas` para evitar que um futuro `apply` sobrescreva a decisão do HPA. Ao remover esse campo pela primeira vez de um manifesto anteriormente aplicado, pode haver retorno momentâneo ao padrão de um; o HPA reconcilia o mínimo. Planeje essa transferência antes de carga e confirme disponibilidade. Escala manual após instalar HPA pode ser desfeita pelo controlador; use-a apenas em exercício planejado.

## Leituras por Job separado

```bash
kubectl --context kind-infralab create configmap load-http-script -n infralab --from-file=scripts/load-http.mjs --dry-run=client -o yaml | kubectl --context kind-infralab apply -f -
kubectl --context kind-infralab create -f k8s/load-job.yaml
kubectl --context kind-infralab get hpa -n infralab --watch
```

`create` gera um nome exclusivo de Job; `apply` não aceita `generateName` para este uso. O manifesto final usa Node nativo: alvo aproximado de 200 operações/s, no máximo oito operações simultâneas, somente GET, por 60 segundos, timeout por requisição e limite total do Job. O script espaça operações em cada worker; não oferece precisão de um gerador distribuído. Não altera tarefas. O gerador também disputa recursos do mesmo nó; isso limita conclusões de capacidade. A carga moderada pode não exigir aumento do HPA: ausência de aumento com CPU abaixo do alvo é comportamento correto.

Em outro terminal, substitua `NOME` pelo nome retornado:

```bash
kubectl --context kind-infralab logs -n infralab job/NOME
kubectl --context kind-infralab wait --for=condition=complete job/NOME -n infralab --timeout=120s
kubectl --context kind-infralab top pods -n infralab
kubectl --context kind-infralab describe hpa/backend -n infralab
```

Logs finais mostram total, erros classificados, throughput e p50/p95/p99 em milissegundos, aproximados em buckets de 1 ms com teto 5000 ms. p95 significa que aproximadamente 95% das operações ficaram até esse tempo. Qualquer erro reprova o Job; investigue os tipos em `failures` e os logs antes de repetir.

Na demonstração de estresse, editamos as variáveis do Job para concorrência 32 por 180 segundos, com deadline 240 e sem limite de taxa (`REQUESTS_PER_SECOND=0`). O HPA chegou a dez APIs, mas houve timeouts; esse nível não foi aprovado como capacidade sustentável. Para repetir estresse, prepare uma cópia do YAML com esses valores, avalie recursos e monitore cada camada. Não espere que a quantidade de réplicas elimine gargalos do proxy ou banco.

O backend atual combina RollingUpdate (`maxUnavailable: 0`, `maxSurge: 1`) com um hook `preStop` de cinco segundos antes de SIGTERM. Isso dá tempo à propagação da retirada do endpoint; a API fecha servidor/pool de forma controlada. O grace period de 30 segundos inclui essa espera. Em produção, dimensione pelo tempo de drenagem real e teste durante atualização; cinco segundos não são uma garantia universal.

Espere escala aumentar se CPU superar o alvo. Após terminar, redução aguarda janela de 120 segundos e remove até dois Pods a cada 30 segundos, respeitando mínimo dois. Não force CPU artificial na API para concluir que tráfego real exige escala. Se não aumentar, confira CPU, limites e gargalos Nginx/banco/gerador antes de mudar parâmetros.

## Validação funcional

```bash
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- env BASE_URL=http://frontend:8080 EXPECTED_DATABASE=postgres node --input-type=module < backend/tests/app.test.mjs
```

Os testes criam e excluem somente sua tarefa temporária. Consulte resultados medidos em [docs/ESCALABILIDADE.md](../../docs/ESCALABILIDADE.md). Produção requer carga representativa, clientes separados, metas de latência/erro e investigação de gargalos; quantidade de Pods não prova capacidade.

Pergunta: com request 150m e CPU 90m, qual porcentagem o HPA observa?

Anterior: [08](08-backup.md). Próximo: [10 — Diagnóstico](10-diagnostico-observabilidade.md).

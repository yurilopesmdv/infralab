# Escalabilidade da API

## Estado validado

API PostgreSQL 0.2.1 escalada manualmente de duas para cinco e dez réplicas, todas Ready. Metrics Server 0.8.1 instalado no kind; HPA autoscaling/v2 controla entre duas e dez réplicas por CPU, com alvo de 60% do request. Aumento sob leituras e redução sem carga foram observados. PostgreSQL e PVCs permanecem preservados.

As duas APIs acessam o mesmo PostgreSQL pelo Service `postgres`. O Service backend seleciona Pods Ready com label `app: backend`. Conexões persistentes podem continuar no mesmo Pod; não assumir distribuição uniforme por requisição.

Todos os Pods estão no único nó kind. Aumentar réplicas aqui não adiciona computadores, capacidade física ou alta disponibilidade entre nós. PostgreSQL continua com uma réplica.

## Mudança e comandos

Antes do HPA, uma quantidade fixa poderia ser declarada assim:

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

Dry-run valida sem persistir. Rollout aguarda disponibilidade. O manifest atual usa RollingUpdate e omite replicas para entregar esse campo ao HPA. Em um cluster novo, aplique também `k8s/backend-hpa.yaml` para obter mínimo dois; antes de instalar HPA, escala manual usa `kubectl scale`. O primeiro apply que remove replicas do histórico declarativo pode voltar ao padrão de um; o HPA reconcilia para seu mínimo. Em produção, planeje essa transferência de controle em vez de fazê-la durante carga.

Teste funcional sem Node no host:

```bash
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- env BASE_URL=http://frontend:8080 EXPECTED_DATABASE=postgres node --input-type=module < backend/tests/app.test.mjs
```

`-i` envia o arquivo pela entrada padrão. As variáveis selecionam frontend e banco esperado. Os testes criam/excluem somente sua tarefa temporária. Três testes passaram; isso não comprova throughput máximo.

## Recursos

Cada API solicita 150m CPU e 64Mi memória, com limites de 500m e 256Mi. Duas réplicas somam requests de 300m e 128Mi; esses valores não representam consumo real.

O pool permite até cinco conexões por processo: duas APIs podem abrir dez; dez APIs podem abrir cinquenta, fora outros clientes. RollingUpdate com maxSurge 1 pode elevar a onze APIs e 55 conexões. `SHOW max_connections` retornou 100 no PostgreSQL. O número de conexões sozinho não comprova capacidade; CPU, consultas, memória e latência também limitam a aplicação.

A API `v1beta1.metrics.k8s.io` agora é fornecida pelo Metrics Server. Isso é separado da etapa Prometheus. Referência: [HPA oficial](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).

## Medições exploratórias em 14/10/2026

| APIs | Concorrência | Duração | Leituras | Erros | req/s | p95 |
|---|---|---|---|---|---|---|
| 2 | 8 | 20,06 s | 17.460 | 0 | 870,37 | 78 ms |
| 10 | 8 | 20 s | 21.279 | 0 | 1.063,89 | 66 ms |

Nesses dois testes iniciais, o gerador executou dentro de uma API e disputou seu limite de CPU. Não são benchmarks isolados nem demonstram capacidade máxima ou ganho linear. A segunda demonstração usa um Job separado, ainda no mesmo nó. O script `scripts/load-http.mjs` realiza somente GET e limita duração/concorrência; não altera tarefas. Percentis são aproximados por buckets de 1 ms, com teto de 5000 ms.

## Reproduzir HPA e carga

```bash
kubectl --context kind-infralab apply -k k8s/metrics-server
kubectl --context kind-infralab top pods -n infralab
kubectl --context kind-infralab apply -f k8s/backend-hpa.yaml
kubectl --context kind-infralab create configmap load-http-script -n infralab --from-file=scripts/load-http.mjs --dry-run=client -o yaml | kubectl --context kind-infralab apply -f -
kubectl --context kind-infralab create -f k8s/load-job.yaml
kubectl --context kind-infralab get hpa/backend -n infralab --watch
```

Use o nome retornado pelo create em `kubectl logs job/NOME -n infralab` e `kubectl wait --for=condition=complete job/NOME -n infralab --timeout=120s`. O manifesto final usa carga moderada: alvo aproximado de 200 operações/s, 60 segundos, concorrência máxima oito e deadline de 120 segundos, sem retentativas automáticas. Os testes de estresse descritos abaixo não limitavam taxa, usavam concorrência 32 por 180 segundos e não cumpriram o critério de zero erros.

HPA usa média da CPU como porcentagem de requests. 60% de 150m é 90m; não é porcentagem do limit nem do nó. A redução aguarda estabilização de 120 segundos e remove até dois Pods por 30 segundos. `unknown` persistente exige verificar Metrics Server, requests e eventos antes de alterar alvos.

Primeira execução isolada, Job `load-http-f6lz9`: 289.389 leituras em 180,05 segundos, 393 falhas (0,14%), p95 59 ms e 1.607,23 operações/s. O Job terminou Failed porque qualquer erro reprova o script. Durante esta execução houve o primeiro apply removendo replicas do histórico declarativo, com redução momentânea ao padrão de um e recuperação pelo HPA; isso é uma hipótese para falhas transitórias, não uma causa confirmada. Os logs disponíveis não mostraram erros de banco ou HTTP 5xx. O gerador foi atualizado para classificar falhas HTTP/transporte antes da repetição. Preserve esta tentativa como evidência, sem chamar o resultado de teste aprovado.

Repetição sem alterações de Deployment, Job `load-http-tpsln`: 284.224 leituras em 180,02 segundos, 307 falhas (0,11%), todas `TimeoutError` após cinco segundos; p95 66 ms e 1.578,86 operações/s. Também terminou Failed. A hipótese da transferência de replicas não explica sozinha o resultado, pois timeouts persistiram sem essa mudança. O Nginx atingiu 500m de CPU no primeiro estresse, seu limite, e o PostgreSQL mostrou 51 conexões de 100 possíveis. Isso sinaliza pressão no caminho HTTP; não confirma uma causa única. Não aumentamos limites nem alteramos a aplicação para mascarar falhas.

O HPA reagiu à carga e chegou automaticamente a dez APIs em ambas as execuções, reduzindo depois em repouso. Três testes funcionais passaram durante o primeiro estresse, e a tarefa original foi preservada. Falha do Job de estresse registra o critério de erro, não perda de dados ou falha permanente da implantação. Novos testes de capacidade devem coletar latência de cada camada, throttling e erros ao longo do tempo; isso conecta este capítulo à observabilidade.

Um teste adicional com oito operações simultâneas, mas ainda sem limite de taxa, Job `load-http-p768p`, fez 96.992 leituras e teve 64 falhas: 30 HTTP 502 e 34 TimeoutError, enquanto houve redução e novo aumento de réplicas. Concorrência oito ainda produziu cerca de 1.500 operações/s, portanto não definia sozinha uma carga moderada. Nginx registrou HTTP 499 ao cliente desistir. A tentativa foi preservada.

Por isso o exemplo final limita também taxa. O Deployment acrescenta `preStop` de cinco segundos, mantendo o servidor disponível enquanto a remoção de endpoints se propaga, antes de SIGTERM. A API já trata SIGTERM fechando o servidor e depois o pool; o grace period de 30 segundos inclui o hook. Essa espera reduz risco de encerramento prematuro, mas não garante ausência de falhas em qualquer rede/carga. Referência: [terminação de Pods](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination).

O manifesto local Metrics Server desativa validação TLS do kubelet para kind; consulte [a configuração](../k8s/metrics-server/README.md). Produção requer certificados válidos. Nginx, PostgreSQL e gerador podem limitar a carga antes das APIs. Conexões persistentes também podem concentrar tráfego em alguns Pods.

## Ponto de retomada para a próxima sessão

O Job `load-http-tscch`, com alvo de 200 operações/s durante RollingUpdate e preStop de cinco segundos, fez 7.893 leituras e teve 43 falhas (nove HTTP 502 e 34 timeouts). Logo, diminuir taxa e acrescentar preStop não resolveram sozinhos a falha. Logs Nginx confirmaram `Connection refused` ao conectar ao Service backend durante retirada de Pods, além de HTTP 499 quando o cliente desistiu.

A configuração final do Nginx agora usa upstream `backend_api` apontando ao mesmo Service, `keepalive 16`, HTTP/1.1 e cabeçalho Connection vazio para reutilizar conexões; timeout de conexão de dois segundos torna esse erro mais rápido de identificar. Não alteramos kube-proxy ou configuração global. Referência: [keepalive Nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#keepalive).

Após a atualização do frontend, `nginx -t` e os três testes funcionais passaram. Estado final: duas APIs Ready, frontend e PostgreSQL Ready, HPA ativo e ambos os PVCs Bound. **O reteste de carga da configuração final ficou para a próxima sessão, a pedido do usuário. Não há validação de zero erros em carga sustentada com essa configuração.** Primeiro repetir o Job moderado; depois, se passar, medir escala/atualização e estresse com coleta por camada. Se falhar, investigar antes de aumentar recursos ou declarar capacidade.

Prometheus/Grafana ainda não foram instalados. Os guias sequenciais serão concluídos antes de iniciar esse módulo.

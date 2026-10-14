# 06 — Deployments, Services, ConfigMap e probes

## O que aprender e por quê

Pod reúne os containers executados juntos. Deployment mantém a quantidade desejada e substitui Pods. Service fornece endereço estável e seleciona Pods por labels. ConfigMap guarda configuração sem segredo; PVC solicita armazenamento persistente.

Exemplo da relação Service → Pod:

```yaml
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: http
```

O Pod precisa ter label `app: backend` e porta nomeada `http`. O Deployment usa `apiVersion: apps/v1`; Service e ConfigMap usam `v1`. Erro “no matches for kind Deployment in version v1” pede corrigir a API, não instalar CRDs.

## Escolha o caminho correto

**Cluster atual já migrado:** não execute novamente a sequência SQLite. Consulte e valide os recursos abaixo.

**Laboratório novo, com objetivo de repetir SQLite:** a imagem atual 0.2.1 ainda suporta SQLite; prepare uma cópia local do manifest em `k8s/legacy/backend-sqlite-deployment.yaml`, substituindo apenas a imagem por `infralab-backend:0.2.1`, mantendo uma réplica e `Recreate`. O arquivo legado referencia 0.1.0 histórica, que não deve ser reconstruída a partir do código atual sob a mesma versão. Aplique o PVC, depois sua cópia do Deployment e o Service. Não registre essa cópia se ela for somente para o exercício.

```bash
kubectl --context kind-infralab apply -f k8s/backend-pvc.yaml
kubectl set image --local -f k8s/legacy/backend-sqlite-deployment.yaml backend=infralab-backend:0.2.1 -o yaml > /tmp/infralab-backend-sqlite.yaml
kubectl --context kind-infralab apply --dry-run=server -f /tmp/infralab-backend-sqlite.yaml
kubectl --context kind-infralab apply -f /tmp/infralab-backend-sqlite.yaml
kubectl --context kind-infralab apply -f k8s/backend-service.yaml
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
```

**Laboratório novo com PostgreSQL direto:** siga primeiro o capítulo 07 para Secret, Service e StatefulSet. Sem origem SQLite, pule o Job de migração; aplique o Deployment PostgreSQL atual e o Service backend. HPA será aplicado no capítulo 09. Nunca aplique recursivamente todos os arquivos `k8s/`: eles representam fases diferentes.

## Frontend após backend pronto

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/frontend-configmap.yaml
kubectl --context kind-infralab apply -f k8s/frontend-configmap.yaml
kubectl --context kind-infralab apply -f k8s/frontend-deployment.yaml
kubectl --context kind-infralab apply -f k8s/frontend-service.yaml
kubectl --context kind-infralab rollout status deployment/frontend -n infralab --timeout=120s
kubectl --context kind-infralab exec -n infralab deployment/frontend -- nginx -t
kubectl --context kind-infralab port-forward -n infralab service/frontend 8081:8080
```

Mantenha o último terminal aberto. Em outro terminal, teste localhost:8081/api/tasks. O caminho é navegador → port-forward → Nginx → Service backend → API → banco. Port-forward é temporário; não é exposição pública de produção.

A ConfigMap é montada com `subPath`: alterar seu conteúdo não atualiza automaticamente o arquivo do Pod existente. Uma atualização requer reiniciar controladamente o Deployment frontend depois de validar a configuração.

## Saúde e recursos

```yaml
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: http
livenessProbe:
  httpGet:
    path: /api/health/live
    port: http
resources:
  requests:
    cpu: 150m
    memory: 64Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

Readiness impede tráfego para Pods sem condições de servir. Liveness pode reiniciar o container após falhas consecutivas. Kubernetes usa suas probes; não executa automaticamente o HEALTHCHECK do Dockerfile. Requests orientam agendamento; CPU limit pode causar throttling e exceder memória pode causar OOMKilled.

## Validação e aprendizado

```bash
kubectl --context kind-infralab get pods,pvc,services -n infralab
kubectl --context kind-infralab describe pods -n infralab -l app=backend
kubectl --context kind-infralab logs deployment/backend -n infralab --tail=20
kubectl --context kind-infralab get endpointslices -n infralab -l kubernetes.io/service-name=backend
```

Investigue eventos antes de aumentar timeouts. “connection refused” nas probes costuma pedir conferir porta e processo. Não confunda Running com Ready.

Pergunta: um Pod Running pode ficar fora do tráfego do Service? Por quê?

Anterior: [05](05-kind-kubernetes.md). Próximo: [07 — PostgreSQL](07-postgres-migracao.md).

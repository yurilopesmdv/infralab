# Kubernetes local, passo a passo

**Status: frontend, backend e persistência implantados e validados.** O usuário criou o cluster, aplicou os manifests e testou a aplicação no navegador durante as aulas. Primeiro valide o [guia de Docker](DOCKER.md).

Ambiente validado: WSL 3.0.3.0, Docker Engine 29.8.2 com cgroup v2, kind 0.33.0 e Kubernetes/kubectl 1.35.8. A falha inicial foi diagnosticada nos logs do kubelet: cgroup v1 impedia sua inicialização. Após atualizar WSL e reiniciar Docker, o cluster incompleto foi removido e recriado pelo usuário.

## Backend: arquivos e execução

| Arquivo | Função |
|---|---|
| `k8s/namespace.yaml` | Agrupa recursos em `infralab` |
| `k8s/backend-pvc.yaml` | Solicita `1Gi` na classe `standard` |
| `k8s/backend-deployment.yaml` | Uma réplica, volume, probes e recursos |
| `k8s/backend-service.yaml` | Endereço interno estável na porta 3000 |

As imagens foram carregadas com `kind load docker-image infralab-backend:0.1.0 infralab-frontend:0.1.0 --name infralab`. O Deployment usa `imagePullPolicy: Never`, exigindo imagem já disponível no nó.

Para um cluster já criado, valide e aplique os arquivos nesta ordem: Namespace, PVC, Deployment e Service. Exemplo do procedimento para cada arquivo:

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/namespace.yaml
kubectl --context kind-infralab apply -f k8s/namespace.yaml
```

`--dry-run=server` valida sem persistir alterações. Ao concluir a aplicação dos quatro arquivos:

```bash
kubectl --context kind-infralab rollout status deployment/backend -n infralab --timeout=120s
kubectl --context kind-infralab get pods,pvc,services -n infralab
kubectl --context kind-infralab port-forward -n infralab service/backend 3001:3000
```

Esperado: Pod `Running 1/1`, PVC `Bound` e Service `ClusterIP` na porta 3000. A classe usa `WaitForFirstConsumer`: PVC `Pending` antes do Pod pode ser normal. `ReadWriteOnce` limita escrita a um nó, não a um único Pod. Uma réplica e `Recreate` evitam sobreposição planejada de escritores durante atualizações; não escale SQLite.

Com o encaminhamento aberto, em outro terminal:

```bash
curl --fail -sS http://localhost:3001/api/health/ready
curl --fail -sS -H 'Content-Type: application/json' -d '{"title":"Aprender persistência no Kubernetes"}' http://localhost:3001/api/tasks
curl --fail -sS http://localhost:3001/api/tasks
```

Persistência foi validada: encerrar o port-forward com `Ctrl+C`, executar `kubectl --context kind-infralab rollout restart deployment/backend -n infralab`, aguardar o rollout e reabrir o encaminhamento. A tarefa permaneceu. O reinício interrompe brevemente a API; execute esse exercício com autorização.

Para investigar: `kubectl --context kind-infralab describe pods -n infralab -l app=backend` e `kubectl --context kind-infralab logs deployment/backend -n infralab --tail=30`. Na aula, probes falharam porque a porta nomeada `http` apontava para 8080; ela deve apontar para 3000, onde a API escuta. Deployment usa `apps/v1`; Namespace, PVC e Service usam `v1`.

O volume é separado do banco Compose. A política de recuperação é `Delete`: excluir o PVC pode apagar os dados. Não o exclua para corrigir erros. O armazenamento local não garante sobrevivência à exclusão do cluster kind.

## Frontend: ConfigMap, Deployment e Service

O ConfigMap `frontend-nginx` contém `nginx.conf`. O Deployment monta esse arquivo em `/etc/nginx/nginx.conf` usando `subPath`, sem substituir os demais arquivos do diretório. Executa com UID/GID 101, sem elevação de privilégios, com probes em `/health` e limites de recursos. As probes verificam o Nginx, não a disponibilidade do backend.

Execute na ordem abaixo, parando se qualquer validação falhar:

```bash
kubectl --context kind-infralab apply --dry-run=server -f k8s/frontend-configmap.yaml
kubectl --context kind-infralab apply -f k8s/frontend-configmap.yaml
kubectl --context kind-infralab apply --dry-run=server -f k8s/frontend-deployment.yaml
kubectl --context kind-infralab apply -f k8s/frontend-deployment.yaml
kubectl --context kind-infralab rollout status deployment/frontend -n infralab --timeout=120s
kubectl --context kind-infralab exec -n infralab deployment/frontend -- nginx -t
kubectl --context kind-infralab apply --dry-run=server -f k8s/frontend-service.yaml
kubectl --context kind-infralab apply -f k8s/frontend-service.yaml
kubectl --context kind-infralab get pods,services -n infralab
```

Esperado: Pods `Running 1/1` e Nginx com `syntax is ok` e `test is successful`. A validação do Kubernetes não substitui a validação da sintaxe Nginx. Com `subPath`, atualizar o ConfigMap exige substituir os Pods para receberem o arquivo atualizado; Nginx não recarrega a configuração automaticamente.

O Nginx usa `backend.infralab.svc.cluster.local:3000`. O Service mantém o endereço interno e seleciona Pods prontos por `app: backend`. O DNS não depende do IP individual do Pod. Essa configuração substitui o resolver `127.0.0.11` específico da rede Compose.

Para acessar sem conflitar com o Compose na porta 8080:

```bash
kubectl --context kind-infralab port-forward -n infralab service/frontend 8081:8080
```

Mantenha esse terminal aberto; em outro:

```bash
curl --fail -sS http://localhost:8081/api/health/ready
curl --fail -sS http://localhost:8081/api/tasks
```

Abra http://localhost:8081, crie e conclua uma tarefa. Esse exercício foi validado pelo usuário. O fluxo é navegador → port-forward → frontend/Nginx → Service backend → Pod da API → SQLite no PVC. Service `ClusterIP` é interno; port-forward fornece acesso local temporário e precisa ser reaberto se o Pod ao qual se conectou for substituído.

## Sequência de aprendizado

| Passo | Conceito e configuração | Validação que aprenderemos |
|---|---|---|
| 1 | Conferir kind e kubectl; explicar cluster e contexto antes de instalar ou criar recursos | `kind get clusters`, `kubectl config current-context` |
| 2 | Criar um cluster local com kind; os nós serão containers Docker | `kubectl get nodes` |
| 3 | Construir imagens com tags explícitas e carregá-las no kind; entender que imagens do host não ficam automaticamente disponíveis nos nós | `kind load docker-image`, verificação dos Pods |
| 4 | Criar Namespace e armazenamento persistente para SQLite; conferir a StorageClass disponível | `kubectl get namespaces`, `kubectl get storageclass`, `kubectl get pvc` |
| 5 | Criar Deployment da API com uma réplica, usuário sem root, requests/limits e volume; usar estratégia que evite duas APIs escrevendo no SQLite durante atualização | `kubectl get pods`, `kubectl describe pod`, `kubectl logs` |
| 6 | Configurar readiness em `/api/health/ready` e liveness em `/api/health/live` | Estado Ready e eventos dos Pods |
| 7 | Criar Service interno para a API; configurar Nginx para o DNS do Kubernetes, substituindo o resolver específico do Docker | Service, endpoints e chamadas entre Pods |
| 8 | Criar Deployment e Service do frontend; usar port-forward para acesso local inicialmente | `kubectl port-forward`, teste pelo navegador |
| 9 | Repetir CRUD e verificar persistência após substituir o Pod; explicar que armazenamento local do kind tem limites e não sobrevive necessariamente à exclusão do cluster | Testes Node, PVC e logs |

O Compose não foi simplesmente copiado: `depends_on` não tem equivalente direto em Kubernetes, health checks dos Dockerfiles não substituem probes e o DNS do Nginx foi adaptado à rede do cluster.

## Como as probes serão utilizadas

- **Readiness:** determina se o Pod pode receber tráfego pelo Service. Falha deve retirar o Pod dos endpoints prontos.
- **Liveness:** verifica se o processo precisa ser reiniciado após falhas consecutivas. Não deve depender do PostgreSQL futuro.
- **Startup:** pode ser adicionada se a inicialização exigir mais tempo, conforme a necessidade medida.

Requests orientam agendamento; limits limitam consumo. HPA ficará para depois da migração para PostgreSQL e exige uma fonte de métricas apropriada.

## Etapas seguintes

PostgreSQL está implantado e sua persistência foi validada. A migração concluiu a cópia de uma tarefa pelo Job sqlite-to-postgres-v2; a API 0.2.1 usa PostgreSQL e o fluxo completo passou nos testes HTTP do cluster. Siga [o guia PostgreSQL](POSTGRESQL.md) para reproduzir a transição. A referência SQLite foi preservada em `k8s/legacy/`; não aplique essa pasta junto com os manifests atuais.

Migrar para PostgreSQL antes de escalar escrita. Só então aumentar réplicas e estudar HPA. Depois instrumentar métricas HTTP e instalar Prometheus/Grafana, incluindo latência, taxa de erros, alertas e correlação com logs JSON. Cada etapa terá seu próprio guia, branch, testes e commit.

Pergunta que vamos responder na prática: se um Pod é substituído, quais recursos mantêm os dados e quais mantêm o endereço de acesso ao serviço?

Referência: [probes na documentação oficial do Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/probes/).

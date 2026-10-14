# Kubernetes local, passo a passo

**Status: backend implantado e validado; frontend pendente.** O usuário criou o cluster e aplicou os manifests durante as aulas. Primeiro valide o [guia de Docker](DOCKER.md).

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

O Compose não será simplesmente copiado: `depends_on` não tem equivalente direto em Kubernetes, health checks dos Dockerfiles não substituem probes e o DNS do Nginx precisa mudar. Vamos explicar cada diferença na configuração correspondente.

## Como as probes serão utilizadas

- **Readiness:** determina se o Pod pode receber tráfego pelo Service. Falha deve retirar o Pod dos endpoints prontos.
- **Liveness:** verifica se o processo precisa ser reiniciado após falhas consecutivas. Não deve depender do PostgreSQL futuro.
- **Startup:** pode ser adicionada se a inicialização exigir mais tempo, conforme a necessidade medida.

Requests orientam agendamento; limits limitam consumo. HPA ficará para depois da migração para PostgreSQL e exige uma fonte de métricas apropriada.

## Etapas seguintes

Migrar para PostgreSQL antes de escalar escrita. Só então aumentar réplicas e estudar HPA. Depois instrumentar métricas HTTP e instalar Prometheus/Grafana, incluindo latência, taxa de erros, alertas e correlação com logs JSON. Cada etapa terá seu próprio guia, branch, testes e commit.

Pergunta que vamos responder na prática: se um Pod é substituído, quais recursos mantêm os dados e quais mantêm o endereço de acesso ao serviço?

Referência: [probes na documentação oficial do Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/probes/).

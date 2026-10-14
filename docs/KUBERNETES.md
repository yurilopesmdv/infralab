# Próxima etapa: Kubernetes local, passo a passo

**Status: planejado, ainda não implementado.** Primeiro valide o [guia de Docker](DOCKER.md). Não há manifests nem cluster criados por esta etapa.

Vamos reutilizar a aplicação funcionando, aprendendo um recurso por vez. Comandos de instalação, versões e arquivos serão apresentados e validados quando o módulo for autorizado.

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

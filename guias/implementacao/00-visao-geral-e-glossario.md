# 00 — Visão geral, camadas e glossário

Este arquivo explica o papel de cada componente do InfraLab. Os capítulos seguintes mostram os comandos e arquivos para implementá-los. Execute os comandos desses capítulos na raiz do projeto, pelo Ubuntu WSL.

## 1. Camadas da aplicação

```text
Navegador: executa React e envia HTTP
   ↓ localhost:8081, via port-forward no Kubernetes
Service frontend → Pod frontend: Nginx entrega HTML/JS/CSS
   ↓ /api/*, encaminhado pelo proxy Nginx
Service backend → Pods backend: Node.js executa regras e consultas
   ↓ conexão PostgreSQL pela rede interna
Service postgres → postgres-0: servidor de banco
   ↓ arquivos no diretório montado
PVC → PV → armazenamento local do nó kind
```

| Camada | Componente | Responsabilidade |
|---|---|---|
| Interface | React | Exibe tarefas e envia operações à API |
| Entrega HTTP e proxy | Nginx | Entrega arquivos do frontend e encaminha `/api/` |
| Aplicação | Node.js/TypeScript | Valida entradas, executa CRUD e registra logs |
| Acesso a dados | `store.ts` e driver `pg` | Executa consultas e controla conexões |
| Banco | SQLite ou PostgreSQL | Guarda tarefas e mantém consistência dos dados |
| Persistência | Volume Docker ou PVC/PV | Mantém arquivos fora do ciclo de vida do container/Pod |
| Recuperação | Backup PostgreSQL | Permite restaurar uma cópia dos dados |

React executa no navegador, não dentro do Nginx. Nginx entrega o resultado compilado. O navegador chama `/api/tasks`; Nginx conhece o endereço interno da API. As APIs compartilham PostgreSQL, não um banco independente por réplica.

No Compose, o caminho é `localhost:8080 → Nginx → backend:3000 → arquivo SQLite em volume`. SQLite é uma biblioteca e um arquivo: não existe container SQLite separado. No Kubernetes atual, PostgreSQL é um servidor com Pod e armazenamento próprios. Os bancos desses dois ambientes são separados.

## 2. Camadas de execução

| Componente | O que é no laboratório |
|---|---|
| Windows | Sistema que hospeda WSL e Docker Desktop |
| WSL 2 / Ubuntu | Ambiente Linux onde usamos terminal e arquivos do projeto |
| Docker Desktop | Fornece o daemon Docker integrado ao WSL |
| Docker | Constrói imagens e executa containers |
| Docker Compose | Declara serviços, rede e volumes da execução inicial |
| kind | Cria nós Kubernetes como containers Docker |
| Nó kind | Container `infralab-control-plane`; dentro dele, containerd executa os containers dos Pods |
| Kubernetes | Mantém os recursos declarados e reconcilia o estado desejado com o estado real |
| kubectl | Cliente que envia comandos ao API server Kubernetes |

O único nó kind acumula funções de control plane e execução das aplicações. Dez Pods da API nesse nó continuam compartilhando a mesma capacidade física; não representam dez computadores.

## 3. Docker: imagem, container e camadas de build

| Termo | Significado | Exemplo InfraLab |
|---|---|---|
| Imagem | Pacote com filesystem e configuração para criar containers | `infralab-backend:0.2.1` |
| Tag | Nome de uma versão da imagem; tecnicamente pode ser substituído | `0.2.1` |
| Container | Instância em execução de uma imagem | Backend iniciado pelo Compose |
| Dockerfile | Receita de construção da imagem | `backend/Dockerfile` |
| Contexto de build | Arquivos disponibilizados ao build | Pasta `backend/` |
| `.dockerignore` | Exclui arquivos desnecessários do contexto | Dependências locais e arquivos temporários |
| Multi-stage | Separa construção e execução em etapas | Compilar TypeScript e copiar somente `dist` para runtime |
| Rede Docker | Conecta serviços por nomes internos | Nginx acessa `backend:3000` |
| Volume | Armazenamento com ciclo de vida separado do container | `sqlite-data` montado em `/app/data` |
| Porta publicada | Encaminhamento de uma porta do host ao container | `127.0.0.1:8080:8080` |
| HEALTHCHECK | Comando Docker que avalia a saúde do container | Consultar readiness da API |

As **camadas da imagem** são diferentes das camadas da arquitetura. Instruções como `COPY` e `RUN` podem produzir alterações de filesystem que o Docker reutiliza em cache. Copiar `package*.json` e instalar dependências antes de copiar código permite reutilizar a instalação quando só o código muda. As etapas multi-stage não são serviços separados em execução.

`EXPOSE 3000` documenta a porta esperada na imagem; não publica essa porta no host. Publicação é configurada no Compose ou em `docker run -p`.

## 4. Estrutura de um objeto Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: infralab
spec:
  # Estado desejado, específico desse tipo de recurso.
```

| Campo | Função |
|---|---|
| `apiVersion` | Seleciona o grupo e a versão da API do recurso |
| `kind` | Identifica o tipo do objeto, como Deployment ou Service |
| `metadata.name` | Nome do objeto |
| `metadata.namespace` | Namespace ao qual pertence, quando o recurso tem namespace |
| `metadata.labels` | Marcadores usados para selecionar e organizar objetos |
| `metadata.annotations` | Informações adicionais; não são seletores de Pods |
| `spec` | Configuração desejada enviada ao Kubernetes |
| `status` | Estado observado, preenchido pelos controladores |

`kind` nesse YAML significa tipo do recurso; a ferramenta **kind**, em minúsculas, cria o cluster local. São usos diferentes do mesmo nome.

## 5. Recursos Kubernetes utilizados

| Recurso / API | O que faz | Uso no InfraLab |
|---|---|---|
| Namespace — `v1` | Organiza recursos dentro do cluster | `infralab` para a aplicação; `kube-system` para componentes do sistema |
| Pod — `v1` | Unidade de execução com um ou mais containers, rede e volumes compartilhados | Instâncias da API, frontend, banco e diagnóstico |
| Deployment — `apps/v1` | Mantém réplicas e gerencia atualizações de aplicações | Backend, frontend e Metrics Server |
| ReplicaSet — `apps/v1` | Mantém a quantidade de Pods de um template | Criado e gerenciado pelos Deployments |
| StatefulSet — `apps/v1` | Mantém identidade e associação de armazenamento por instância | `postgres-0` e seu PVC |
| Service — `v1` | Fornece descoberta e endereço de acesso aos Pods selecionados | Backend, frontend e PostgreSQL |
| EndpointSlice — `discovery.k8s.io/v1` | Registra os destinos e condições usados pelos Services | IPs/portas dos Pods da API; gerenciado automaticamente |
| ConfigMap — `v1` | Guarda configuração sem segredo | Nginx e script de carga |
| Secret — `v1` | Guarda dados sensíveis e os disponibiliza aos Pods | Credenciais PostgreSQL, fora do Git |
| PersistentVolumeClaim — `v1` | Solicita armazenamento para um workload | SQLite e PostgreSQL |
| PersistentVolume — `v1` | Representa armazenamento disponibilizado no cluster | Criado pelo provisionador para atender um PVC |
| StorageClass — `storage.k8s.io/v1` | Define como provisionar armazenamento | `standard`, com provisionador local do kind |
| Job — `batch/v1` | Executa uma tarefa finita | Migração e carga HTTP |
| HorizontalPodAutoscaler — `autoscaling/v2` | Ajusta réplicas com base em métricas | API entre duas e dez réplicas por CPU |
| ServiceAccount — `v1` | Identidade de um workload perante a API Kubernetes | Metrics Server; aplicação não monta token da API |
| ClusterRole — `rbac.authorization.k8s.io/v1` | Define permissões de alcance do cluster | Leitura necessária ao Metrics Server |
| RoleBinding / ClusterRoleBinding — `rbac.authorization.k8s.io/v1` | Associa permissões a identidades, com escopo namespace/cluster | Instalação oficial do Metrics Server |
| APIService — `apiregistration.k8s.io/v1` | Registra uma API agregada no API server | `v1beta1.metrics.k8s.io`, fornecida pelo Metrics Server |

Não editamos ReplicaSets ou EndpointSlices diretamente para administrar o backend; alteramos o Deployment/Service e deixamos os controladores reconciliar os recursos derivados.

### Deployment, ReplicaSet e Pod

```text
Deployment backend
   └─ ReplicaSet da versão do template
         ├─ Pod backend-A → container Node.js
         └─ Pod backend-B → container Node.js
```

Pod não é sinônimo de container, embora nossos Pods de aplicação tenham um container principal. Se o processo falha, o kubelet pode reiniciar o container no Pod. Se o Pod é removido, o controlador pode criar outro Pod para manter a quantidade desejada. São ações diferentes.

### StatefulSet não configura replicação do banco

`postgres-0` mantém uma identidade estável e usa `postgres-data-postgres-0`. Criar mais réplicas de StatefulSet, sozinho, não configura replicação PostgreSQL, eleição de primário ou failover. Nosso banco tem uma instância; as várias APIs usam essa mesma instância.

## 6. Service: tipos, portas e seleção

| Tipo | Comportamento | Situação no laboratório |
|---|---|---|
| `ClusterIP` | Endereço virtual acessível pela rede interna do cluster | Backend e frontend |
| Headless (`type: ClusterIP`, `clusterIP: None`) | Sem IP virtual do Service; DNS retorna destinos dos endpoints | PostgreSQL |
| `NodePort` | Expõe uma porta nos nós, além do acesso interno | Não utilizado |
| `LoadBalancer` | Solicita integração com um balanceador externo disponível no ambiente | Não utilizado |
| `ExternalName` | Alias DNS para um nome externo, sem proxy do Service | Não utilizado |

Headless é uma configuração de Service, não um valor separado de `spec.type`. Um LoadBalancer precisa de uma implementação que forneça essa integração; o nome do tipo não cria automaticamente um balanceador no kind.

Trecho do Service backend:

```yaml
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: http
```

- `selector.app: backend` encontra Pods com essa label, independentemente do nome completo deles.
- `port` é a porta de acesso do Service.
- `targetPort: http` aponta para a porta nomeada `http` no Pod: 3000 no backend.
- `containerPort` descreve a porta do container; declarar esse campo não inicia um servidor HTTP.
- `backend.infralab.svc.cluster.local` é o nome DNS do Service neste cluster.

Nginx usa esse DNS dentro do cluster. O navegador acessa localhost pelo port-forward. O Service encaminha conexões; conexões persistentes podem manter várias requisições no mesmo Pod. Não devemos presumir distribuição uniforme por requisição.

`kubectl port-forward service/frontend 8081:8080` conecta uma porta local a um Pod escolhido para o Service. Não é um Ingress nem um balanceador público; precisa ser reaberto se esse Pod for substituído.

## 7. Atualizações, saúde e recursos

| Configuração | Significado no projeto |
|---|---|
| `Recreate` | Encerra Pods antigos antes de iniciar os novos; usado na aula SQLite |
| `RollingUpdate` | Substitui Pods gradualmente; estratégia atual da API |
| `maxSurge: 1` | Permite um Pod adicional durante a atualização |
| `maxUnavailable: 0` | Controlador mantém disponibilidade desejada durante rollout; não é garantia de zero erros de rede |
| `preStop` | Hook antes do encerramento; API espera cinco segundos para propagação da retirada do endpoint |
| `terminationGracePeriodSeconds` | Prazo de encerramento, incluindo preStop; padrão de 30 segundos usado aqui |
| Readiness probe | Define se o Pod pode receber tráfego; API consulta o banco |
| Liveness probe | Detecta falha do processo e pode provocar reinício do container |
| Startup probe | Protege a inicialização antes de ativar liveness/readiness; usada no PostgreSQL |
| CPU request | Base de agendamento e do cálculo percentual do HPA |
| CPU limit | Limite que pode provocar throttling |
| Memory request | Valor considerado pelo agendamento |
| Memory limit | Exceder o limite pode resultar em OOMKilled |
| `imagePullPolicy: Never` | Exige imagem já carregada no nó; escolha local para as APIs/frontend |
| `securityContext` | Define usuário, privilégios e capabilities dos processos |
| `automountServiceAccountToken: false` | Evita montar credenciais da API Kubernetes onde não são necessárias |

`150m` significa 0,15 CPU; `64Mi` significa 64 mebibytes. O alvo HPA de 60% sobre request 150m equivale a aproximadamente 90m por API. Isso não significa 60% do limit nem do computador.

Readiness e liveness são verificações diferentes. Banco indisponível deve retirar a API do tráfego via readiness, sem provocar reinícios em massa de processos saudáveis. Kubernetes usa as probes dos manifests, não o HEALTHCHECK do Dockerfile.

## 8. Tipos de volumes e ciclo de vida dos dados

| Configuração | Uso / ciclo de vida |
|---|---|
| Volume nomeado Docker | SQLite Compose; preservado ao substituir containers |
| Volume com PVC | Dados PostgreSQL e SQLite no Kubernetes; independente do Pod enquanto armazenamento existir |
| `configMap` como volume | Arquivos de configuração Nginx e script de carga |
| `emptyDir` | Armazenamento temporário do Pod, como `/tmp` do Metrics Server; desaparece com o Pod |
| `volumeMounts` | Define em qual diretório o container recebe um volume |
| `readOnly` | Monta um volume sem permitir escrita pelo container |
| `subPath` | Monta um arquivo/subdiretório específico; atualização da ConfigMap não atualiza esse arquivo automaticamente |
| `ReadWriteOnce` (RWO) | Montagem de leitura/escrita em um nó; não significa um único Pod |
| `WaitForFirstConsumer` | Provisionamento/vinculação espera um Pod consumidor para decidir localização |
| Reclaim policy `Delete` | Remover o PVC pode levar à remoção do PV e armazenamento pelo provisionador |

PVC não é uma cópia de segurança. Excluir o cluster kind pode perder seu armazenamento local. Backups em `.backups/postgres/` ficam fora do kind, mas no mesmo computador; proteger contra perda da máquina exige outro local. Replicar a API não replica o banco.

## 9. Control plane, rede e observabilidade

| Componente | Papel |
|---|---|
| API server | Recebe operações kubectl e valida recursos |
| etcd | Guarda estado/configuração do cluster; não é o banco de tarefas da aplicação |
| Scheduler | Escolhe o nó para um Pod ainda não agendado |
| Controller manager | Executa controladores que mantêm o estado desejado, incluindo HPA |
| kubelet | Gerencia Pods/containers e probes no nó |
| containerd | Runtime que executa os containers dentro do nó kind |
| CoreDNS | Resolve nomes internos, como o Service backend |
| kindnet | Implementa conectividade de rede dos Pods no kind |
| kube-proxy | Configura encaminhamento dos Services; neste laboratório usa iptables |
| Local-path provisioner | Provisiona armazenamento local para PVCs |
| Metrics Server | Fornece amostras recentes de CPU/memória para `top` e HPA |

Logs JSON registram eventos individuais. Request ID ajuda a correlacionar uma requisição. Prometheus coleta métricas ao longo do tempo e Grafana exibe dashboards. Ambos estão implantados com PVCs próprios. Métricas HTTP usam `/metrics`, uma interface separada das probes JSON de saúde.

Ingress e seu controlador também não estão implementados: Ingress declara regras HTTP e um controlador as executa. Nosso acesso atual continua por port-forward.

## 10. Ler o estado atual

```bash
kubectl --context kind-infralab get deployments,statefulsets,services,pvc,hpa -n infralab
kubectl --context kind-infralab get pods -n infralab
kubectl --context kind-infralab get endpointslices -n infralab -l kubernetes.io/service-name=backend
kubectl --context kind-infralab top pods -n infralab
```

`READY 2/2` no Deployment indica duas réplicas prontas. `READY 1/1` num Pod indica um container pronto dentre um declarado. `Running` sozinho não comprova readiness. `Bound` num PVC indica vínculo com PV. O HPA mostra valor atual/alvo e quantidade de réplicas.

A implantação mantém duas a dez APIs sob controle do HPA, frontend e PostgreSQL com armazenamento persistente. A validação de carga moderada também cobre a troca gradual dos Pods. Veja [resultados e limites](../../docs/ESCALABILIDADE.md).

Para conferir o aprendizado: quem cria um Pod substituto quando o Deployment perde uma réplica? Qual componente guarda as tarefas: etcd ou PostgreSQL?

Próximo: [01 — Ambiente](01-ambiente.md). Voltar ao [índice](README.md).

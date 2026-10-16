# 12 — Grafana e leitura dos dashboards

Anterior: [11 — Prometheus](11-prometheus.md). Grafana consulta dados; não coleta `/metrics` nem substitui o banco de séries do Prometheus.

## O que aprender e por quê

Uma fonte de dados informa onde consultar. Um painel combina consulta e visualização. Um dashboard reúne painéis que ajudam a responder perguntas operacionais: quanto tráfego chega, quantas respostas falham, qual a latência e quais processos usam recursos.

## 1. Credencial fora do Git

Na implantação atual, a senha foi gerada aleatoriamente e está em `.secrets/grafana-admin-password`, ignorada pelo Git. Para um laboratório novo, execute uma vez na raiz:

```bash
umask 077
mkdir -p .secrets
# noclobber evita sobrescrever um arquivo já existente:
(set -o noclobber; openssl rand -hex 24 > .secrets/grafana-admin-password)
kubectl --context kind-infralab create secret generic grafana-admin -n infralab --from-literal=username=admin --from-file=password=.secrets/grafana-admin-password
```

Não recrie Secret nem senha existentes. O arquivo é apenas para acesso privado local; não entra em commits. Grafana lê o Secret por variáveis GF_SECURITY_ADMIN_USER/PASSWORD na primeira inicialização do seu banco persistente. Alterar o Secret depois não redefine automaticamente a senha do usuário já criado; rotação exige procedimento próprio.

O SQLite interno do Grafana guarda usuários e configurações, não tarefas da aplicação. Uma réplica Grafana com PVC é suficiente aqui; escalar Grafana com seu SQLite compartilhado não é uma configuração de alta disponibilidade.

## 2. Provisionamento por arquivos

[datasources.yaml](../../k8s/observability/datasources.yaml) cria a fonte Prometheus:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

`access: proxy` faz o servidor Grafana acessar o Service interno. O navegador não precisa resolver o nome prometheus. UID permite que os painéis referenciem uma fonte estável.

[dashboards.yaml](../../k8s/observability/dashboards.yaml) aponta para a pasta montada com [infralab.json](../../k8s/observability/infralab.json). Esse provisionamento evita configurar manualmente tudo após reconstruir o laboratório. Edite o JSON versionado e reaplique Kustomize; mudanças geram ConfigMap com novo hash e atualização do Deployment. O dashboard é controlado por arquivos e não deve depender de alterações só na interface.

## 3. Aplicar e acessar

Depois de preparar Secret e imagens do capítulo anterior:

```bash
kubectl --context kind-infralab apply -k k8s/observability
kubectl --context kind-infralab rollout status deployment/grafana -n infralab --timeout=180s
kubectl --context kind-infralab port-forward -n infralab service/grafana 3002:3000
```

Abra http://localhost:3002. Usuário: `admin`. Em outro terminal Ubuntu, consulte sua senha local:

```bash
cat .secrets/grafana-admin-password
```

Use-a somente no login; não a copie para documentação, prints ou comandos de commit. O port-forward mantém acesso apenas local. Se o Pod escolhido for substituído, reabra o encaminhamento. A API usa outra porta; 3002 local encaminha para 3000 do Grafana.

## 4. Ler o dashboard

Em Dashboards, abra a pasta **InfraLab** e o dashboard **InfraLab — HTTP e processos**. Comece com últimos 15 minutos e atualização de 15 segundos.

| Painel | O que responde | Como interpretar |
|---|---|---|
| Requisições por segundo | Qual o tráfego médio recente? | Soma de rate dos contadores das réplicas |
| Erros HTTP 5xx (%) | Que proporção de respostas da API falha no servidor? | 5xx dividido pelo total; 4xx aparece no painel de status |
| Latência p95 | Até que tempo estão aproximadamente 95% das respostas? | Histograma agregado; unidade segundos |
| Réplicas coletadas com sucesso | Quantos targets API estão UP? | Não substitui estado do Deployment/HPA |
| Tráfego por Pod | O tráfego se concentra em alguma réplica? | Conexões persistentes podem gerar distribuição desigual |
| Respostas por status | Predominam 2xx, 4xx ou 5xx? | Validação de entrada pode gerar 400 sem falha do servidor |
| Memória do processo por Pod | Qual o RSS observado? | Não é exatamente a memória total do container |
| CPU do processo por Pod | Quantas CPUs o processo consome em média? | Não é a porcentagem de request usada pelo HPA |

Exemplo da consulta de erro:

```promql
100 * (sum(rate(infralab_http_requests_total{job="infralab-api",status_code=~"5.."}[2m])) or vector(0))
 / clamp_min(sum(rate(infralab_http_requests_total{job="infralab-api"}[2m])), 0.000001)
```

`or vector(0)` apresenta zero quando nenhuma série 5xx existe; `clamp_min` evita divisão por zero. Com ausência total de tráfego, zero nesse painel não comprova disponibilidade: olhe também coleta e probes. Requisições que não chegaram à API, como falhas no proxy, não aparecem nesse percentual.

## 5. Exercício de leitura

Execute o Job moderado do capítulo 11 e observe subida do tráfego, latência e CPU. Após terminar, a janela de dois minutos faz o gráfico cair gradualmente. Use Explore com a fonte Prometheus para testar uma expressão sem alterar o dashboard.

Um retorno No data pode significar falta de duas amostras, nenhuma requisição de negócio ainda, janela errada ou falha da fonte/coleta. Verifique nessa ordem:

```bash
kubectl --context kind-infralab get pods,services,pvc -n infralab
kubectl --context kind-infralab logs deployment/grafana -n infralab --tail=30
kubectl --context kind-infralab logs deployment/prometheus -n infralab --tail=30
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- node --input-type=module < scripts/verify-observability.mjs
```

No Prometheus, confira Targets UP antes de alterar consultas. Grafana ter `/api/health` saudável não garante que a fonte de dados esteja funcionando.

## Aprendizado e limites

Dashboard ajuda a formular hipóteses; não prova sozinho a causa de um incidente. Combine métricas com logs JSON e request ID. Centralização com Loki, tracing e notificações externas não estão implementados. Acesso de produção precisa de TLS, usuários/permissões apropriados e gestão de segredos. O usuário admin local não representa o perfil de todos os usuários em produção.

Perguntas: o que investigar se Grafana estiver saudável mas os painéis não tiverem dados? Por que CPU do processo em cores não é a porcentagem mostrada pelo HPA?

Referência: [provisionamento oficial Grafana](https://grafana.com/docs/grafana/latest/administration/provisioning/).

Voltar ao [índice](README.md).

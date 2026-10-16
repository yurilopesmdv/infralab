# 13 — Gerar tráfego e criar gráficos

Anterior: [12 — Grafana](12-grafana.md). Pré-requisitos: aplicação, Prometheus e Grafana implantados, com fonte Prometheus provisionada.

## O que aprender e por quê

Os gráficos precisam de amostras na janela selecionada. Fazer login não gera automaticamente tráfego de negócio nem cria uma consulta no Prometheus. O dashboard InfraLab já vem provisionado; este exercício gera requisições reais para acompanhá-lo e ensina a criar um painel próprio.

Não precisamos criar tarefas falsas no banco. Consultar uma lista vazia também produz uma resposta HTTP e suas métricas. A demonstração usa somente GET; não muda títulos, estados ou registros existentes.

## 1. Conferir a coleta

Na raiz do projeto, no Ubuntu WSL:

```bash
kubectl --context kind-infralab get pods -n infralab
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- node --input-type=module < scripts/verify-observability.mjs
```

No Prometheus, abra Targets: os Pods da API devem estar UP. O número pode mudar pelo HPA, por isso a verificação não exige exatamente duas réplicas por padrão. Opcionalmente, EXPECTED_API_REPLICAS permite conferir uma quantidade estável conhecida.

## 2. Gerar dados por cinco minutos

```bash
kubectl --context kind-infralab create configmap load-http-script -n infralab --from-file=scripts/load-http.mjs --dry-run=client -o yaml | kubectl --context kind-infralab apply -f -
kubectl --context kind-infralab create -f k8s/observability/demo-job.yaml
```

O create retorna `job.batch/observability-demo-NOME`. Cada execução recebe um nome novo. Não aplique esse arquivo com apply: ele usa generateName. O Job não é incluído no apply da stack, para que instalar observabilidade não dispare tráfego automaticamente.

Parâmetros do manifest:

```yaml
activeDeadlineSeconds: 360
# Dentro do container:
env:
  - name: DURATION_SECONDS
    value: "300"
  - name: CONCURRENCY
    value: "8"
  - name: REQUESTS_PER_SECOND
    value: "200"
```

São cinco minutos, no máximo oito operações simultâneas e alvo aproximado de 200 operações/s no total, não por worker. O prazo de 360 segundos também limita o Job; não há retentativas automáticas. A taxa real depende de latência, agendamento e recursos. A imagem 0.3.0 já deve existir no kind.

O teste comum em `k8s/load-job.yaml` dura um minuto. A versão demo dura mais para permitir observar os gráficos enquanto trabalha. Não precisa deixar um gerador ilimitado rodando.

## 3. Abrir e atualizar o dashboard

Mantenha um terminal com:

```bash
kubectl --context kind-infralab port-forward -n infralab service/grafana 3002:3000
```

Abra http://localhost:3002 ou diretamente http://localhost:3002/d/infralab-http. Entre com admin e sua senha privada local. A página inicial usa o dashboard InfraLab, configurado por GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH.

Selecione **Last 30 minutes** e atualização de **15s**. Use o botão de atualizar. Espere de 30 a 45 segundos após iniciar a carga: Prometheus coleta a cada 15 segundos e rate precisa de mais de uma amostra.

| Painel | O que esperar |
|---|---|
| Respostas acumuladas nas APIs | Número crescente; permanece visível após a carga |
| Requisições por segundo | Linha positiva durante o teste; próxima do alvo após estabilizar a janela |
| Latência p95 | Duração estimada pelo histograma, normalmente exibida em ms pela unidade automática |
| Réplicas coletadas | Quantidade de targets UP; pode variar com o HPA |
| Tráfego por Pod | Distribuição entre processos, que pode ser desigual por conexões persistentes |
| Respostas por status | Predominância de 200 nas leituras |
| Erros HTTP 5xx | Zero quando não há falhas de servidor |
| CPU e memória por Pod | Valores reais dos processos durante o exercício |

O acumulado é a soma dos contadores dos processos atuais; reinicia com os processos e pode diminuir em trocas de Pods. Não é um contador histórico global de todas as requisições desde a criação do projeto.

Quando o teste acabar, a taxa cai gradualmente, pois usa janela de dois minutos. O p95 fica sem valor quando não há novas observações: não existe latência de requisições que não aconteceram. CPU, memória, coleta e acumulado ajudam a distinguir repouso de ausência de coleta.

## 4. Gerar respostas 404 para observar status

Opcionalmente, em outro terminal:

```bash
kubectl --context kind-infralab exec -i -n infralab deployment/backend -- node --input-type=module <<'NODE'
for (let i = 0; i < 10; i++) {
  const response = await fetch('http://frontend:8080/api/exercicio-inexistente');
  if (response.status !== 404) throw new Error('Esperado 404');
  await response.arrayBuffer();
}
console.log('10 respostas 404 esperadas, sem mudar tarefas.');
NODE
```

Espere a próxima coleta e observe a série 404 no painel de status. O painel 5xx continua zero porque 404 é uma resposta de cliente/rota, não uma falha de servidor. Não precisamos derrubar o banco para produzir um gráfico de erro.

## 5. Consultar no Prometheus

Em outro terminal, mantenha:

```bash
kubectl --context kind-infralab port-forward -n infralab service/prometheus 9090:9090
```

Abra http://localhost:9090. No campo de expressão, informe a consulta e execute; alterne entre tabela e gráfico:

```promql
sum(rate(infralab_http_requests_total{job="infralab-api"}[2m]))
```

Para separar respostas:

```promql
sum by (status_code) (
  rate(infralab_http_requests_total{job="infralab-api"}[2m])
)
```

A página de consultas não escolhe sozinha qual expressão você quer desenhar. Já o Grafana traz expressões salvas nos painéis.

## 6. Criar seu próprio gráfico no Grafana

O dashboard provisionado é controlado pelo JSON do repositório. Para praticar sem alterar esse arquivo, crie outro dashboard pela interface:

1. Vá a **Dashboards → New → New dashboard**.
2. Use **Add new element (+) → Panel → Configure visualization**.
3. Na aba **Queries**, selecione a fonte **Prometheus**, escolha modo **Code** e informe:

```promql
sum by (route) (
  rate(infralab_http_requests_total{job="infralab-api"}[2m])
)
```

4. Execute a consulta. Escolha visualização **Time series**.
5. Defina título **Tráfego por rota**, unidade **requests/sec** e legenda `{{route}}`.
6. Salve/aplique o painel conforme os controles exibidos e salve o dashboard como **InfraLab — exercícios**.
7. Selecione últimos 30 minutos e atualização de 15 segundos. Repita o Job para observar a curva.

O dashboard salvo pela interface fica no banco interno do Grafana, preservado pelo PVC. Para reproduzi-lo por Git, exporte o JSON pelas opções de exportação do dashboard e revise o arquivo antes de versionar. O dashboard oficial já usa esse fluxo: `infralab.json` → ConfigMap → provisionamento Grafana.

## 7. Encerrar e validar

Não é necessário parar manualmente o gerador: ele termina após cinco minutos. Use o nome retornado no create:

```bash
kubectl --context kind-infralab logs job/observability-demo-NOME -n infralab
kubectl --context kind-infralab wait --for=condition=complete job/observability-demo-NOME -n infralab --timeout=360s
kubectl --context kind-infralab get hpa -n infralab
```

O resumo é impresso ao terminar e inclui total, erros, taxa efetiva e percentis. Complete significa saída bem-sucedida do gerador; Failed exige investigar o relatório. Fechar o navegador ou interromper um comando de acompanhamento com Ctrl+C não encerra o Job. Não remova PVCs para limpar um exercício.

Métricas continuam armazenadas no Prometheus após a carga; para vê-las depois, selecione uma janela que inclua o horário do teste, dentro da retenção configurada. A demonstração local não comprova capacidade máxima de produção.

## Aprendizado

Por que taxa zero e targets UP podem ser simultaneamente corretos? Por que gerar 404 não faz subir o painel de erros 5xx?

Referências: [criar dashboard Grafana](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/) e [página inicial](https://grafana.com/docs/grafana/latest/administration/organization-preferences/).

Voltar ao [índice](README.md).

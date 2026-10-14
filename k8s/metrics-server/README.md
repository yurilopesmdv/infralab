# Metrics Server para kind

`components.yaml` é o manifesto oficial, sem alterações, da versão 0.8.1:
https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.8.1/components.yaml

O Kustomize adiciona limites e `--kubelet-insecure-tls` para o certificado kubelet do kind. Essa exceção desativa a validação do certificado do kubelet; use somente no laboratório. Produção exige certificados válidos e dimensionamento próprio. O APIService do manifesto oficial também usa `insecureSkipTLSVerify` na conexão do API server ao Metrics Server; revise certificados nessa conexão em produção.

```bash
kubectl --context kind-infralab apply --dry-run=server -k k8s/metrics-server
kubectl --context kind-infralab apply -k k8s/metrics-server
kubectl --context kind-infralab rollout status deployment/metrics-server -n kube-system --timeout=120s
kubectl --context kind-infralab top pods -n infralab
```

`-k` renderiza recursos e patches com Kustomize embutido no kubectl. `top` mostra amostras recentes de CPU e memória; não é histórico nem painel Prometheus. Referência: [projeto oficial](https://github.com/kubernetes-sigs/metrics-server).

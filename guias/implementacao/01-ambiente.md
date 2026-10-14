# 01 — Ambiente

## O que aprender e por quê

WSL executa Linux no Windows. Docker Desktop fornece o daemon Docker integrado ao Ubuntu. O cliente `docker` conversa com esse daemon; executar o cliente não significa que o daemon esteja disponível.

## Execução

```bash
uname -m
cat /etc/os-release
wsl.exe --version
docker version
docker compose version
git --version
kubectl version --client
kind version
docker info --format 'Servidor={{.ServerVersion}} | CgroupVersion={{.CgroupVersion}} | CgroupDriver={{.CgroupDriver}}'
```

`uname -m` escolhe arquitetura de binários: este laboratório usa x86_64/amd64. `docker version` deve mostrar cliente e servidor; erro de conexão pede conferir Docker Desktop e integração WSL. `cgroup` é o mecanismo Linux para contabilizar e limitar recursos; nosso cluster foi validado após atualizar WSL e obter cgroup v2.

Se uma ferramenta faltar, consulte [o diagnóstico do ambiente](../../docs/SETUP-VSCODE.md) antes de instalar. Não execute comandos PowerShell diretamente no Bash; use PowerShell do Windows ou `powershell.exe -NoProfile -Command '...'`.

## Validação e aprendizado

Todas as consultas devem responder sem alterar configurações. Em produção, os nós Linux são provisionados e atualizados de forma controlada; WSL e Docker Desktop são ferramentas de laboratório.

Pergunta: qual a diferença entre versão do cliente Docker e versão do servidor?

Próximo: [02 — API e SQLite](02-api-sqlite.md).

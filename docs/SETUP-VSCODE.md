# VS Code e Ubuntu WSL

## Objetivo

Editar arquivos no filesystem Linux e executar os comandos no terminal Ubuntu. Docker Desktop deve estar em execução e integrado à distribuição WSL usada pelo projeto. VS Code é opcional para executar a aplicação.

## Abrir o repositório existente

No terminal Ubuntu:

```bash
cd ~/projects/infralab
code .
```

Se usar VS Code com integração WSL, confira a indicação da distribuição no canto inferior esquerdo e abra um terminal Bash. Comandos PowerShell pertencem ao terminal PowerShell; pelo Bash, precisam ser invocados explicitamente com `powershell.exe`.

## Conferir sem instalar ou alterar

```bash
bash scripts/check-environment.sh
docker version
docker compose version
git status
kubectl version --client
kind version
```

Docker deve mostrar cliente e servidor. Se o servidor não responder, confira Docker Desktop e sua integração com a distribuição antes de mudar arquivos do projeto. Instalações e ajustes globais são etapas separadas.

## Fluxo de trabalho

Leia [as regras do projeto](../AGENTS.md) e [o roadmap](ROADMAP.md). Use branch por funcionalidade, confira o diff e faça commit após validar o escopo. A identidade Git já está configurada; não altere configuração global. O repositório já está inicializado: não repita comandos de criação, renomeação de branch ou cadastro de remote.

Push e merge devem ser ações autorizadas. Ao retomar trabalho, confira a branch atual e as pendências antes de executar alterações. Para aprender o ambiente em sequência, siga [o capítulo 01](../guias/implementacao/01-ambiente.md).

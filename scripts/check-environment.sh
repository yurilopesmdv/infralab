#!/usr/bin/env bash
set -u
for cmd in 'cat /etc/os-release' 'uname -r' 'git --version' 'docker version' 'docker compose version' 'docker context show'; do
  printf '\n== %s ==\n' "$cmd"
  bash -lc "$cmd" || echo 'Falhou ou não instalado: verificar antes de prosseguir.'
done
printf '\nDepois de validar o Docker: docker run --rm hello-world\n'

#!/usr/bin/env bash
set -euo pipefail
# Senha efêmera somente para este ambiente isolado; não gravar nem imprimir.
INFRALAB_TEST_PASSWORD=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
export INFRALAB_TEST_PASSWORD
cleanup() { docker compose -f compose.postgres-test.yaml down; }
trap cleanup EXIT
docker compose -f compose.postgres-test.yaml up --build -d --wait
docker compose -f compose.postgres-test.yaml build test
docker compose -f compose.postgres-test.yaml --profile test run --no-deps --rm test

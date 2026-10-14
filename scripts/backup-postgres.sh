#!/usr/bin/env bash
# Backup lógico fora do cluster. Executar na raiz do projeto pelo Ubuntu WSL.
set -euo pipefail
umask 077
backup_dir="$PWD/.backups/postgres"
mkdir -p "$backup_dir"
partial=$(mktemp "$backup_dir/infralab-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump.partial")
printf 'Criando backup PostgreSQL fora do cluster...\n'
if ! kubectl --context kind-infralab exec -n infralab postgres-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h postgres -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" -Fc --no-owner --no-acl' > "$partial"; then
  printf 'Backup falhou. Arquivo incompleto preservado: %s\n' "$partial" >&2
  exit 1
fi
test -s "$partial"
kubectl --context kind-infralab exec -i -n infralab postgres-0 -- pg_restore --list < "$partial" > /dev/null
backup_file="${partial%.partial}"
mv "$partial" "$backup_file"
(
  cd "$backup_dir"
  sha256sum "$(basename "$backup_file")" > "$(basename "$backup_file").sha256"
)
printf 'Backup criado: %s\n' "$backup_file"
printf 'Checksum: %s.sha256\n' "$backup_file"

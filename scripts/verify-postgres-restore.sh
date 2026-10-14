#!/usr/bin/env bash
# Restaura em banco novo e compara tarefas. Não substitui nem remove o banco original.
set -euo pipefail
if [ "$#" -ne 1 ]; then
  printf 'Uso: bash scripts/verify-postgres-restore.sh CAMINHO_DO_BACKUP.dump\n' >&2
  exit 1
fi
backup_file=$(realpath "$1")
test -s "$backup_file"
test -f "$backup_file.sha256"
(
  cd "$(dirname "$backup_file")"
  sha256sum --check "$(basename "$backup_file").sha256"
)

# Nome gerado internamente: nenhum argumento permite selecionar o banco da aplicação.
restore_db="infralab_restore_$(date -u +%Y%m%d%H%M%S)_${BASHPID}"
printf 'Criando banco separado de teste: %s\n' "$restore_db"
kubectl --context kind-infralab exec -n infralab postgres-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec createdb -h postgres -U "$POSTGRES_USER" -- "$1"' sh "$restore_db"
kubectl --context kind-infralab exec -i -n infralab postgres-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h postgres -U "$POSTGRES_USER" -d "$1" --single-transaction --exit-on-error --no-owner --no-acl' sh "$restore_db" < "$backup_file"

fingerprint_sql="SELECT count(*)::text || ':' || md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) FROM (SELECT id, title, done FROM tasks) AS t"
fingerprint() {
  kubectl --context kind-infralab exec -n infralab postgres-0 -- \
    sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h postgres -U "$POSTGRES_USER" -d "${1:-${POSTGRES_DB:-$POSTGRES_USER}}" -At -v ON_ERROR_STOP=1 -c "$2"' sh "$1" "$fingerprint_sql"
}
source_fingerprint=$(fingerprint '')
restored_fingerprint=$(fingerprint "$restore_db")
if [ "$source_fingerprint" != "$restored_fingerprint" ]; then
  printf 'Dados atuais diferem do backup; novas escritas após a cópia podem explicar. Banco de teste preservado: %s\n' "$restore_db" >&2
  exit 1
fi
printf 'OK: restauração concluída e todas as %s tarefas conferem em ID, título e estado.\n' "${restored_fingerprint%%:*}"
printf 'Banco de teste preservado: %s\n' "$restore_db"
printf 'O banco original e seus volumes não foram removidos nem substituídos.\n'

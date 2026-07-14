#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${ENV_FILE:-$project_root/.env}"

if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "Error: pg_restore and psql must be installed and on PATH." >&2
  exit 1
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <backup-file> [--yes]" >&2
  exit 1
fi

backup_file="$1"
confirm="${2:-}"

if [[ ! -f "$backup_file" ]]; then
  echo "Error: backup file not found: $backup_file" >&2
  exit 1
fi

if [[ "$confirm" != "--yes" ]]; then
  echo "WARNING: this will replace database objects in the database from DATABASE_URL."
  printf 'Continue restoring %s? Type "restore" to continue: ' "$backup_file"
  read -r answer
  if [[ "$answer" != "restore" ]]; then
    echo "Restore cancelled."
    exit 0
  fi
fi

echo "Restoring database from: $backup_file"
sql_file="$(mktemp "${TMPDIR:-/tmp}/whatsapp-tracking-restore.XXXXXX.sql")"
trap 'rm -f "$sql_file"' EXIT

# The source environment may contain settings/extensions unavailable on the target RDS instance.
pg_restore \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$sql_file" \
  "$backup_file"

filtered_sql_file="$(mktemp "${TMPDIR:-/tmp}/whatsapp-tracking-restore-filtered.XXXXXX.sql")"
trap 'rm -f "$sql_file" "$filtered_sql_file"' EXIT
awk '
  $0 == "SET transaction_timeout = 0;" { next }
  /prisma_postgres/ { next }
  /pg_stat_statements/ { next }
  { print }
' "$sql_file" > "$filtered_sql_file"

psql \
  --dbname="$DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --file="$filtered_sql_file"

echo "Restore complete."

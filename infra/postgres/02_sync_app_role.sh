#!/bin/bash
set -euo pipefail

APP_USER="${POSTGRES_APP_USER:-flowforge_app}"
APP_PASS="${POSTGRES_APP_PASSWORD:-flowforge_app_dev_pass}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$APP_USER" -v app_pass="$APP_PASS" <<'EOSQL'
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_pass') \gexec
EOSQL

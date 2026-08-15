#!/usr/bin/env bash
# Idempotent local Postgres + PostGIS setup for Private Dining Finder.
# Uses the Supabase CLI's local stack (see DINER.md/SPECS.md §3.1 alternative).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

if [ ! -f supabase/config.toml ]; then
  supabase init --workdir .
fi

supabase start

DB_CONTAINER=$(docker ps --filter "name=supabase_db_" --format "{{.Names}}" | head -n1)
if [ -z "$DB_CONTAINER" ]; then
  echo "Could not find the supabase_db_ container after 'supabase start'." >&2
  exit 1
fi

for db in postgres diner_test; do
  docker exec "$DB_CONTAINER" psql -U postgres -d "$db" -c \
    'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' \
    >/dev/null 2>&1 || {
      docker exec "$DB_CONTAINER" psql -U postgres -c "CREATE DATABASE $db;" >/dev/null 2>&1 || true
      docker exec "$DB_CONTAINER" psql -U postgres -d "$db" -c \
        'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    }
done

echo "Postgres + PostGIS ready."
docker exec "$DB_CONTAINER" psql -U postgres -c "SELECT postgis_full_version();"

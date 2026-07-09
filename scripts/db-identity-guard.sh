#!/bin/sh
# =============================================================================
# Pre-migrate DB identity guard.
#
# Refuses to run migrations against the wrong database. On first run it stamps
# the DB with APP_NAME/APP_ENVIRONMENT; on every later run it verifies the stamp
# matches. A mismatch (e.g. DATABASE_URL accidentally points at another
# project's DB) aborts BEFORE `prisma migrate deploy` touches anything.
#
# Mirrors the system_database_identity check from the production CARE ERP stack.
# Requires psql (postgresql-client) and DATABASE_URL in the environment.
# =============================================================================
set -e

APP_NAME="${APP_NAME:-care-erp}"
APP_ENVIRONMENT="${APP_ENVIRONMENT:-production}"

if [ -z "$DATABASE_URL" ]; then
  echo "✗ identity-guard: DATABASE_URL is not set" >&2
  exit 1
fi

# Ensure the identity table exists (single-row).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS _app_identity (
  id           integer PRIMARY KEY DEFAULT 1,
  app_name     text NOT NULL,
  environment  text NOT NULL,
  stamped_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _app_identity_single CHECK (id = 1)
);
SQL

current="$(psql "$DATABASE_URL" -tA -c "SELECT app_name || '|' || environment FROM _app_identity WHERE id = 1;")"
expected="${APP_NAME}|${APP_ENVIRONMENT}"

if [ -z "$current" ]; then
  # First deploy against a fresh (or pre-existing but unstamped) DB — stamp it.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO _app_identity (id, app_name, environment) VALUES (1, '${APP_NAME}', '${APP_ENVIRONMENT}');"
  echo "✓ identity-guard: stamped DB as '${expected}'"
elif [ "$current" != "$expected" ]; then
  echo "✗ identity-guard: DB identity mismatch." >&2
  echo "  This database is stamped '${current}' but this deploy expects '${expected}'." >&2
  echo "  Refusing to migrate — check DATABASE_URL / APP_NAME / APP_ENVIRONMENT." >&2
  exit 1
else
  echo "✓ identity-guard: DB identity verified ('${current}')"
fi

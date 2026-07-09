#!/bin/sh
set -e

echo "→ Waiting for PostgreSQL to accept connections..."
# Belt-and-suspenders: compose already gates startup on the db healthcheck,
# but retry migrate deploy a few times in case the DB is briefly unready.
tries=0
until npx prisma migrate deploy 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 10 ]; then
    echo "✗ Database not reachable / migrations failed after $tries attempts — aborting."
    exit 1
  fi
  echo "  migrate attempt $tries failed, retrying in 3s..."
  sleep 3
done

echo "✓ Migrations applied. Starting Care ERP..."
exec node server.js

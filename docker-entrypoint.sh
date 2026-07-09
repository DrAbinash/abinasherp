#!/bin/sh
set -e

# The app does NOT run migrations itself. Schema changes are applied by the
# dedicated one-shot `migrate` service in docker-compose (mirrors the proven
# care-db-patch-v2 -> schema-verify -> api ordering), and the app is gated on
# that service completing successfully. Keeping migration out of the app's
# start path means a migration failure can't put the app into a restart loop.
echo "→ Starting Care ERP (schema managed by the migrate service)..."
exec node server.js

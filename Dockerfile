# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Sub-path the app is served under behind the Synology reverse proxy (e.g. /erp).
# Baked into the client bundle at build time (basePath must be a build constant).
ARG NEXT_PUBLIC_BASE_PATH=/erp
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

# Install bun
RUN npm install -g bun

# Copy manifests + prisma schema first for better layer caching
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install deps
RUN bun install --frozen-lockfile

# Generate Prisma client (postgresql)
RUN bunx prisma generate

# Copy source
COPY . .

# Build (DATABASE_URL is only needed at runtime; a dummy keeps prisma happy if referenced)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bun run build

# ---- Production stage ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Must match the build-time base path for the healthcheck URL below.
ARG NEXT_PUBLIC_BASE_PATH=/erp
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

# openssl: required by Prisma engines. postgresql-client: pg_dump/psql for backup/restore.
# dumb-init: proper PID-1 signal handling.
RUN apk add --no-cache openssl dumb-init postgresql-client

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI + schema + migrations (for `prisma migrate deploy` at startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Entrypoint + pre-migrate DB identity guard (run by the migrate service)
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY scripts/db-identity-guard.sh ./scripts/db-identity-guard.sh
RUN chmod +x ./docker-entrypoint.sh ./scripts/db-identity-guard.sh

# Uploads directory (mounted as a named volume in compose)
RUN mkdir -p /app/uploads/expense-bills /app/uploads/bank-statements

EXPOSE 3000

# Liveness healthcheck — base-path-aware, does NOT touch the DB (see the route).
# start-period is deliberately conservative to cover in-process startup tasks
# (bootstrap admin seed) before the first check fires.
HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- "http://localhost:3000${NEXT_PUBLIC_BASE_PATH}/api/health" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

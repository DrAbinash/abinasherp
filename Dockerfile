# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install deps
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---- Production stage ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/care-erp.db"

# Install openssl (required by Prisma SQLite) and dumb-init
RUN apk add --no-cache openssl dumb-init

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run migrations then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]

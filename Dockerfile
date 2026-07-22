# syntax=docker/dockerfile:1

# Keep the exact tag for readability and the manifest-list digest for
# reproducible multi-architecture builds. Update both together.
ARG NODE_IMAGE=node:22.23.1-alpine3.24@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
ARG DISABLE_HSTS
ENV DISABLE_HSTS=${DISABLE_HSTS}
# These non-secret placeholders are required while Next.js evaluates server
# modules during the build. Scope them to this instruction so they are not
# persisted as image environment metadata.
RUN DATABASE_URL=postgresql://build-placeholder:5432/build \
    REDIS_URL=redis://build-placeholder:6379 \
    npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# postgresql-client supplies pg_dump for pre-migration, scheduled, and manual
# backups. The health check uses Node's built-in fetch, so curl is unnecessary.
RUN apk add --no-cache libc6-compat postgresql-client && \
    addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 --ingroup nodejs nextjs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Markdown sources rendered by the in-app Documentation portal (/docs).
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/README.md ./README.md

RUN mkdir -p /app/data /app/.next/cache && \
    chown -R nextjs:nodejs /app/data /app/.next/cache

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]

USER 10001:10001

# The startup shell exits after the migration/seed steps and exec replaces it
# with Next.js, leaving the application process to receive signals directly.
CMD ["sh", "-c", "node scripts/migrate-db.js && npm run db:seed && exec ./node_modules/.bin/next start"]

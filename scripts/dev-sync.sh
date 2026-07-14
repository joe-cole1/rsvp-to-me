#!/usr/bin/env bash
#
# dev-sync — bring local development services in line with the current branch.
# Run it after switching branches or pulling changes that affect Prisma or seed
# data. Pass --deps only after a fresh clone or package dependency change.
#
# It targets your DEV database (from .env / docker compose), not a throwaway one.
# `npm run db:seed` is safe to re-run: base rows use upsert, and the heavy test
# fixtures only load when SEED_TEST_DATA=true AND the DB has no events yet.
#
set -Eeuo pipefail

INSTALL_DEPS=0
case "${1:-}" in
  "") ;;
  --deps) INSTALL_DEPS=1 ;;
  -h|--help)
    echo "usage: scripts/dev-sync.sh [--deps]"
    exit 0
    ;;
  *)
    echo "unknown option: $1" >&2
    echo "usage: scripts/dev-sync.sh [--deps]" >&2
    exit 1
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

# Codex/Desktop-launched WSL shells can inherit Windows temp paths. Keep Node
# tooling on the native WSL filesystem for reliability and performance.
export TMPDIR=/tmp
export TMP=/tmp
export TEMP=/tmp

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
if command -v nvm >/dev/null 2>&1; then
  nvm use --silent >/dev/null || { echo "✗ Node from .nvmrc is unavailable — run: nvm install" >&2; exit 1; }
fi
command -v node >/dev/null 2>&1 || { echo "✗ node not found — run: nvm install" >&2; exit 1; }

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

step "Starting Postgres + Redis"
docker compose up -d postgres redis

wait_for_health() {
  local service="$1"
  local container_id=""
  local status=""

  for _ in $(seq 1 30); do
    container_id="$(docker compose ps -q "$service")"
    if [ -n "$container_id" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      if [ "$status" = "healthy" ]; then
        return 0
      fi
    fi
    sleep 1
  done

  echo "✗ ${service} did not become healthy within 30 seconds (last status: ${status:-not-started})." >&2
  exit 1
}

step "Waiting for Postgres + Redis health checks"
wait_for_health postgres
wait_for_health redis

if [ "$INSTALL_DEPS" -eq 1 ]; then
  step "Installing locked dependencies (npm ci)"
  npm ci
elif [ ! -d node_modules ]; then
  echo "✗ node_modules is missing — rerun with: scripts/dev-sync.sh --deps" >&2
  exit 1
fi

step "Regenerating Prisma client (db:generate)"
npm run db:generate

step "Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy

step "Seeding baseline data (db:seed — idempotent)"
npm run db:seed

printf '\n\033[1;32m✓ Local environment synced to %s\033[0m\n' "$(git rev-parse --abbrev-ref HEAD)"

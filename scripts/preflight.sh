#!/usr/bin/env bash
#
# Local CI — full parity with .github/workflows/ci.yml. Run before every push so
# you never wait on GitHub to find a failure you could have caught locally.
#
# It spins up EPHEMERAL Postgres/Redis containers (identical to CI's service
# containers) on non-standard ports, so it never touches your dev database, then
# runs the exact CI step list against them and tears them down on exit.
#
#   scripts/preflight.sh          # full CI parity, including Playwright E2E
#   scripts/preflight.sh --fast   # everything except E2E (much faster)
#
set -Eeuo pipefail

# ---- Load Node (nvm) so this works from any shell, interactive or not --------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
command -v node >/dev/null 2>&1 || { echo "✗ node not found — run: nvm install 22" >&2; exit 1; }

cd "$(git rev-parse --show-toplevel)"

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

# ---- Ephemeral CI-parity services (non-standard ports to avoid dev clashes) --
PG_NAME=preflight-pg
REDIS_NAME=preflight-redis
PG_PORT=55432
REDIS_PORT=56399
SERVER_PID=""

cleanup() {
  ec=$?
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" >/dev/null 2>&1 || true
  docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
  exit $ec
}
trap cleanup EXIT INT TERM

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/rsvp_test"
export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
export SESSION_SECRET="preflight-secret-must-be-at-least-32-characters"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"
export HOST_INVITE_CODE="ci-test"
export EMAIL_FROM="ci@example.com"
export OPEN_REGISTRATION="true"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

step "Starting ephemeral Postgres + Redis"
docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_test -e POSTGRES_USER=postgres \
  -p "${PG_PORT}:5432" postgres:18-alpine >/dev/null
docker run -d --name "$REDIS_NAME" -p "${REDIS_PORT}:6379" redis:7-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
ok "services up"

step "Install dependencies (npm ci)"
[ -d node_modules ] || npm ci
ok "deps ready"

step "Audit dependencies (npm audit --audit-level=high)"
npm audit --audit-level=high

step "Prettier — format check"
npx prettier --check .

step "ESLint"
npm run lint

step "Prisma generate"
npm run db:generate >/dev/null

step "Database migrations (rsvp_test)"
npx prisma migrate deploy

step "Unit tests"
npm test

step "Integration tests"
npm run test:integration

step "Component tests"
npm run test:components

step "Build (next build)"
npm run build

if [ "$FAST" = 1 ]; then
  ok "PREFLIGHT PASSED — fast mode (E2E skipped)"
  exit 0
fi

step "E2E — starting app server"
npm start >/tmp/preflight-server.log 2>&1 &
SERVER_PID=$!
npx wait-on http://localhost:3000/api/health --timeout 120000

step "E2E — ensuring Playwright Chromium is installed"
npx playwright install chromium >/dev/null

step "E2E — Playwright tests"
PLAYWRIGHT_BASE_URL="http://localhost:3000" npm run test:e2e

ok "PREFLIGHT PASSED — full CI parity ✅"

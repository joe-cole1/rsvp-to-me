#!/usr/bin/env bash
#
# Local CI — full parity with .github/workflows/ci.yml. Run before every push so
# you never wait on GitHub to find a failure you could have caught locally.
#
# It spins up EPHEMERAL Postgres/Redis containers (identical to CI's service
# containers) on NON-DEFAULT ports (55432 / 56399) so it never touches your dev
# database or clashes with dev services (5432 / 6379). It runs the exact CI step
# list against them and tears them down on exit.
#
#   scripts/preflight.sh          # full CI parity, including Playwright E2E
#   scripts/preflight.sh --fast   # everything except E2E (much faster)
#
set -Eeuo pipefail

# ---- Load the repository's Node version in interactive/noninteractive shells -
cd "$(git rev-parse --show-toplevel)"

# shellcheck source=scripts/lib/preflight-process-group.sh
. scripts/lib/preflight-process-group.sh

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

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

# ---- Ephemeral CI-parity services (non-default ports to avoid dev clashes) ----
PG_NAME=preflight-pg
REDIS_NAME=preflight-redis
PG_PORT=55432
REDIS_PORT=56399
E2E_PORT=3001
E2E_OUTPUT_DIR="${TMPDIR}/rsvp-preflight-playwright"
SERVER_PID=""
SERVER_PGID=""

cleanup() {
  local ec=$?
  trap - EXIT INT TERM
  if [ -n "$SERVER_PID" ] && [ -n "$SERVER_PGID" ]; then
    preflight_terminate_process_group "$SERVER_PID" "$SERVER_PGID" || true
  fi
  docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
  exit "$ec"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/rsvp_test"
export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
export SESSION_SECRET="preflight-secret-must-be-at-least-32-characters"
# Unit/integration/component fixtures assert URLs at :3000 (tests/setup.ts default),
# so tests run on :3000. The E2E server switches to :3001 just before the build
# (see below) to avoid clashing with a dev server on :3000.
export NEXT_PUBLIC_APP_URL="http://localhost:3000"
export HOST_INVITE_CODE="ci-test"
export EMAIL_FROM="ci@example.com"
export OPEN_REGISTRATION="true"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

step "Starting ephemeral Postgres + Redis (ports ${PG_PORT}/${REDIS_PORT})"
docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_test -e POSTGRES_USER=postgres \
  -p "${PG_PORT}:5432" postgres:18-alpine >/dev/null
docker run -d --name "$REDIS_NAME" -p "${REDIS_PORT}:6379" redis:7-alpine >/dev/null
db_ready=0
for _ in $(seq 1 30); do
  if docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    db_ready=1
    break
  fi
  sleep 1
done
if [ "$db_ready" -eq 0 ]; then
  echo "✗ Ephemeral Postgres failed to become ready within 30s (Docker issue?)." >&2
  exit 1
fi
ok "services up"

step "Install dependencies (npm ci)"
[ -d node_modules ] || npm ci
ok "deps ready"

step "Audit dependencies (npm audit --audit-level=high)"
npm audit --audit-level=high

step "Prettier — format check"
# Check existing tracked and non-ignored candidate files rather than recursively
# walking the repository. Docker volume directories can be unreadable to the WSL
# user before Prettier applies .prettierignore, while deleted tracked paths must
# not be passed to Prettier at all.
while IFS= read -r -d '' file; do
  if [ -e "$file" ]; then
    printf '%s\0' "$file"
  fi
done < <(git ls-files -co --exclude-standard -z) \
  | xargs -0 -r npx prettier --check --ignore-unknown

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

# Switch to the E2E server port for the build + E2E only. `next build` BAKES
# NEXT_PUBLIC_APP_URL and `next start` binds $PORT, so both must be the E2E port —
# keeping app-generated links consistent with the served port and never clashing
# with a dev server on :3000. (In --fast mode the build simply uses this value.)
export PORT="$E2E_PORT"
export NEXT_PUBLIC_APP_URL="http://localhost:${E2E_PORT}"

step "Build (next build)"
npm run build

# Type-check AFTER build so Next's generated route types (PageProps) resolve, and
# so test files that `next build` does not compile still get checked.
step "Type-check (tsc --noEmit)"
npx tsc --noEmit

if [ "$FAST" = 1 ]; then
  ok "PREFLIGHT PASSED — fast mode (E2E skipped)"
  exit 0
fi

# ---- E2E ---------------------------------------------------------------------
# Seed the fresh ephemeral DB for deterministic state. SEED_TEST_DATA=true loads
# the rich fixtures; the seed is idempotent (upsert base + empty-DB guard).
step "E2E — seeding ephemeral database"
SEED_TEST_DATA=true npm run db:seed

step "E2E — starting app server"
preflight_assert_port_available "$E2E_PORT"
command -v setsid >/dev/null 2>&1 || {
  echo "✗ Cannot isolate the E2E server because the 'setsid' command is unavailable." >&2
  exit 1
}
setsid npm start >/tmp/preflight-server.log 2>&1 &
SERVER_PID=$!
SERVER_PGID="$SERVER_PID"
if ! captured_pgid="$(preflight_capture_process_group "$SERVER_PID")"; then
  exit 1
fi
SERVER_PGID="$captured_pgid"
if ! npx wait-on "http://localhost:${E2E_PORT}/api/health" --timeout 120000; then
  echo "✗ E2E server failed to become healthy. Server log:" >&2
  tail -n 50 /tmp/preflight-server.log >&2 || true
  exit 1
fi
if ! preflight_process_group_alive "$SERVER_PGID"; then
  echo "✗ E2E server process group exited during startup. Server log:" >&2
  tail -n 50 /tmp/preflight-server.log >&2 || true
  exit 1
fi

step "E2E — ensuring Playwright Chromium is installed"
npx playwright install chromium >/dev/null

step "E2E — Playwright tests"
PLAYWRIGHT_BASE_URL="http://localhost:${E2E_PORT}" npm run test:e2e -- --output "$E2E_OUTPUT_DIR"

ok "PREFLIGHT PASSED — full CI parity ✅"

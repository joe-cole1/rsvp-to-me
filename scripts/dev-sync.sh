#!/usr/bin/env bash
#
# dev-sync — bring the local environment in line with the current branch after a
# fetch/pull, so you never hit "works on main, breaks locally" drift. Run it at
# the start of a session (and any time you switch branches or pull).
#
# It targets your DEV database (from .env / docker compose), not a throwaway one.
# `npm run db:seed` is safe to re-run: base rows use upsert, and the heavy test
# fixtures only load when SEED_TEST_DATA=true AND the DB has no events yet.
#
set -Eeuo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
command -v node >/dev/null 2>&1 || { echo "✗ node not found — run: nvm install 22" >&2; exit 1; }

cd "$(git rev-parse --show-toplevel)"
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

step "Starting Postgres + Redis (docker compose up -d)"
docker compose up -d

step "Installing dependencies (npm install)"
npm install

step "Regenerating Prisma client (db:generate)"
npm run db:generate

step "Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy

step "Seeding baseline data (db:seed — idempotent)"
npm run db:seed

printf '\n\033[1;32m✓ Local environment synced to %s\033[0m\n' "$(git rev-parse --abbrev-ref HEAD)"

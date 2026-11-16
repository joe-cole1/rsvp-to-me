#!/usr/bin/env bash
# Check a migrations-only install after the production build, before demo E2E.
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"
. scripts/lib/preflight-process-group.sh
export TMPDIR=/tmp TMP=/tmp TEMP=/tmp
# CI already selects .nvmrc through actions/setup-node. Do not replace that
# runtime merely because nvm is installed with a different/empty version cache.
required_node="$(< .nvmrc)"
required_node="v${required_node#v}"
active_node="$(node --version 2>/dev/null || true)"
if [ "$active_node" != "$required_node" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh" --no-use || {
      echo "Could not load nvm to select the Node version from .nvmrc." >&2
      exit 1
    }
  fi
  if command -v nvm >/dev/null 2>&1; then
    nvm use --silent >/dev/null || {
      echo "Node from .nvmrc is unavailable; install it before running this check." >&2
      exit 1
    }
  fi
fi
if [ "$(node --version 2>/dev/null || true)" != "$required_node" ]; then
  echo "Node from .nvmrc is required; select it before running this check." >&2
  exit 1
fi
export SETUP_SOURCE_DATABASE_URL="${DATABASE_URL:?Set the disposable rsvp_test database URL}"
export SETUP_DATABASE_NAME="rsvp_setup_$(date +%s)_$$"
setup_created=0
setup_dir=$(mktemp -d /tmp/rsvp-setup-check.XXXXXX)
cleanup() {
  local status=$?
  trap - EXIT
  if [ "$setup_created" -eq 1 ]; then
  node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import pg from 'pg';
assert.match(process.env.SETUP_DATABASE_NAME, /^rsvp_setup_[0-9]+_[0-9]+$/);
const client = new pg.Client({connectionString:process.env.SETUP_SOURCE_DATABASE_URL});
await client.connect();
try { await client.query(`DROP DATABASE IF EXISTS "${process.env.SETUP_DATABASE_NAME}" WITH (FORCE)`); }
finally { await client.end(); }
JS
  fi
  rm -rf -- "$setup_dir"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node --input-type=module - "$setup_dir/database-url" <<'JS'
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import pg from 'pg';
const source = new URL(process.env.SETUP_SOURCE_DATABASE_URL);
assert.equal(source.pathname, '/rsvp_test');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(source.hostname));
assert.match(process.env.SETUP_DATABASE_NAME, /^rsvp_setup_[0-9]+_[0-9]+$/);
const client = new pg.Client({connectionString:source.toString()});
await client.connect();
try { await client.query(`CREATE DATABASE "${process.env.SETUP_DATABASE_NAME}"`); }
finally { await client.end(); }
source.pathname='/'+process.env.SETUP_DATABASE_NAME;
writeFileSync(process.argv[2],source.toString(),{mode:0o600});
JS
setup_created=1
export DATABASE_URL="$(cat "$setup_dir/database-url")"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
export PLAYWRIGHT_BASE_URL="$NEXT_PUBLIC_APP_URL"
export PORT="$(node -e 'process.stdout.write(new URL(process.env.NEXT_PUBLIC_APP_URL).port || "80")')"
preflight_assert_port_available "$PORT"
export INITIAL_ADMIN_EMAIL=setup-owner@example.test
export OPEN_REGISTRATION=false SEED_TEST_DATA=false
export TURNSTILE_SITE_KEY="" TURNSTILE_SECRET_KEY=""
unset HOST_INVITE_CODE
npx prisma migrate deploy
npx playwright test --config playwright.setup.config.ts

#!/usr/bin/env bash
# Run after the production build, using only disposable E2E services/fixtures.
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"
. scripts/lib/preflight-process-group.sh
preflight_assert_port_available 3003
export TURNSTILE_SITE_KEY=e2e-dummy-site-key
export TURNSTILE_SECRET_KEY=e2e-dummy-secret-key
export PLAYWRIGHT_BASE_URL=http://localhost:3003
export NEXT_PUBLIC_APP_URL=http://localhost:3003
export OPEN_REGISTRATION=true
npx playwright test --config playwright.turnstile.config.ts

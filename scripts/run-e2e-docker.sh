#!/bin/bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"
PLAYWRIGHT_IMAGE=$(node scripts/playwright-image.cjs)

echo "=== Ensuring E2E Test Database Exists ==="
docker exec rsvp-to-me-postgres-1 psql -U postgres -c "CREATE DATABASE rsvp_test;" 2>/dev/null || true

echo "=== Running Playwright E2E Tests in Docker ==="
docker run --rm \
  --network rsvp-to-me_default \
  -v "$(pwd)":/app \
  -w /app \
  --env-file .env.e2e \
  "$PLAYWRIGHT_IMAGE" \
  bash -c "npx playwright test"

#!/bin/bash
set -e

echo "=== Ensuring E2E Test Database Exists ==="
docker exec rsvp-to-me-postgres-1 psql -U postgres -c "CREATE DATABASE rsvp_test;" 2>/dev/null || true

echo "=== Running Playwright E2E Tests in Docker ==="
docker run --rm \
  --network rsvp-to-me_default \
  -v "$(pwd)":/app \
  -w /app \
  --env-file .env.e2e \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  bash -c "npx playwright test"

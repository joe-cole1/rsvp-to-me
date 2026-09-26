#!/usr/bin/env bash
# Smoke-test a locally built production image using only new disposable data.
# Usage: bash scripts/container-smoke.sh <local-image> <x64|arm64>
set -Eeuo pipefail

image=${1:?Pass the local image to test}
expected_arch=${2:?Pass the expected Node architecture (x64 or arm64)}
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
network_id=""
postgres_id=""
redis_id=""
app_id=""

cleanup() {
  local status=$?
  trap - EXIT
  if [ -n "$app_id" ]; then
    docker logs "$app_id" || true
  fi
  # IDs belong only to containers created by this invocation. -v removes their
  # anonymous test volumes; no existing host paths or Compose data are touched.
  for container_id in "$app_id" "$redis_id" "$postgres_id"; do
    if [ -n "$container_id" ]; then
      docker rm -fv "$container_id" >/dev/null || true
    fi
  done
  if [ -n "$network_id" ]; then
    docker network rm "$network_id" >/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_for_health() {
  local container_id=$1
  for ((attempt = 0; attempt < 90; attempt++)); do
    if [ "$(docker inspect --format '{{.State.Running}}' "$container_id")" != true ]; then
      docker logs "$container_id"
      return 1
    fi
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = healthy ]; then
      return 0
    fi
    sleep 2
  done
  docker logs "$container_id"
  echo "Container did not become healthy within 180 seconds" >&2
  return 1
}

# An internal network prevents fixture startup from reaching external providers.
# No service ports are published and no registry credentials are used.
network_id=$(docker network create --internal "rsvp-qc-$(date +%s)-$$")
postgres_id=$(docker run -d --network "$network_id" --network-alias postgres \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=container-qc \
  -e POSTGRES_DB=rsvp_qc \
  --health-cmd 'pg_isready -U postgres -d rsvp_qc' \
  --health-interval 2s --health-timeout 3s --health-retries 30 \
  postgres:18-alpine)
redis_id=$(docker run -d --network "$network_id" --network-alias redis \
  --health-cmd 'redis-cli ping' \
  --health-interval 2s --health-timeout 3s --health-retries 30 \
  redis:8-alpine)
wait_for_health "$postgres_id"
wait_for_health "$redis_id"

app_id=$(docker run -d --network "$network_id" \
  -e DATABASE_URL=postgresql://postgres:container-qc@postgres:5432/rsvp_qc \
  -e REDIS_URL=redis://redis:6379 \
  -e SESSION_SECRET=container-qc-disposable-secret-at-least-32-characters \
  -e HEALTH_CHECK_TOKEN=container-qc-health \
  -e HOST_INVITE_CODE=container-qc-invite \
  -e EMAIL_FROM=container-qc@example.invalid \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -e SEED_TEST_DATA=false \
  --mount type=volume,destination=/app/data/uploads \
  --mount type=volume,destination=/app/data/backups \
  --health-interval 5s --health-start-period 120s \
  "$image")
wait_for_health "$app_id"

docker exec -i --user 10001:10001 -e EXPECTED_NODE_ARCH="$expected_arch" \
  "$app_id" node < "$script_dir/container-smoke.cjs"

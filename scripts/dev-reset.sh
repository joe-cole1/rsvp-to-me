#!/usr/bin/env bash
#
# Reset the disposable local Postgres and Redis named volumes. This does not
# touch source files, .env, or the production-oriented bind mounts in the base
# Compose file.
#
# Usage: scripts/dev-reset.sh --confirm

set -Eeuo pipefail

if [ "${1:-}" != "--confirm" ] || [ "$#" -ne 1 ]; then
  echo "usage: scripts/dev-reset.sh --confirm" >&2
  echo "This permanently deletes the local development Postgres and Redis data." >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

echo "▶ Removing local development service volumes"
docker compose down --volumes --remove-orphans

echo "▶ Recreating local Postgres and Redis"
scripts/dev-sync.sh

echo "✓ Local development services were reset and reseeded."

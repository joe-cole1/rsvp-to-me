#!/usr/bin/env bash
#
# dev-restart — (re)start the native Next.js dev server for this checkout.
#
#   scripts/dev-restart.sh              stop the dev server on :3000, sync, rebuild, start
#   scripts/dev-restart.sh --stop-only  only stop it
#
# Run it after switching branches, pulling, or a full preflight (which reinstalls
# node_modules under a running server). It stays in the foreground: run it in a
# terminal, or as a background task. A copy detached with `setsid nohup` from a
# one-off `wsl.exe` call is killed when that call returns.
#
# The previous server is found with `ss`. In WSL, `lsof -i` does not list
# Node's listening sockets, so `lsof -t -iTCP:3000` returns nothing and the new
# server would fail with EADDRINUSE. Only a Next.js process is stopped; any other
# listener on the port is reported and left alone.
#
# PORT overrides the port (default 3000).
set -Eeuo pipefail

STOP_ONLY=0
case "${1:-}" in
  "") ;;
  --stop-only) STOP_ONLY=1 ;;
  -h|--help)
    echo "usage: scripts/dev-restart.sh [--stop-only]"
    exit 0
    ;;
  *)
    echo "unknown option: $1" >&2
    echo "usage: scripts/dev-restart.sh [--stop-only]" >&2
    exit 1
    ;;
esac

PORT="${PORT:-3000}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v ss >/dev/null 2>&1 || { echo "✗ ss (iproute2) is required to find the port's listener." >&2; exit 1; }

# PIDs listening on $PORT (IPv4 or IPv6).
listener_pids() {
  ss -H -ltnp "sport = :$PORT" | awk '{ while (match($0, /pid=[0-9]+/)) { print substr($0, RSTART + 4, RLENGTH - 4); $0 = substr($0, RSTART + RLENGTH) } }' | sort -u
}

args_of() { ps -o args= -p "$1" 2>/dev/null || true; }
parent_of() { ps -o ppid= -p "$1" 2>/dev/null | tr -d '[:space:]'; }

# A Next.js server process or one of the wrappers that start it
# (`npm run dev`, `npm exec next dev`, `sh -c next dev`, `node …/next dev`).
is_next() {
  case "$(args_of "$1")" in
    *next-server*|*"next dev"*|*"next start"*|*"npm run dev"*|*"npm exec next"*) return 0 ;;
    *) return 1 ;;
  esac
}

stop_port() {
  local pids pid parent targets=()
  pids="$(listener_pids)"
  [ -n "$pids" ] || return 0

  for pid in $pids; do
    if ! is_next "$pid"; then
      echo "✗ Port $PORT is held by a process that is not a Next.js dev server:" >&2
      echo "  $pid $(args_of "$pid")" >&2
      echo "  Stop it yourself, or run with PORT=<another port>." >&2
      return 1
    fi
    targets+=("$pid")
    # Stop the wrappers too, so nothing is left waiting on (or restarting) the server.
    parent="$(parent_of "$pid")"
    while [ -n "$parent" ] && [ "$parent" -gt 1 ] && is_next "$parent"; do
      targets+=("$parent")
      parent="$(parent_of "$parent")"
    done
  done

  echo "Stopping the Next.js server on :$PORT (pids ${targets[*]})"
  kill -TERM "${targets[@]}" 2>/dev/null || true
  for _ in $(seq 1 50); do
    [ -z "$(listener_pids)" ] && return 0
    sleep 0.2
  done
  kill -KILL "${targets[@]}" 2>/dev/null || true
  for _ in $(seq 1 25); do
    [ -z "$(listener_pids)" ] && return 0
    sleep 0.2
  done
  echo "✗ Port $PORT is still in use after stopping pids ${targets[*]}." >&2
  return 1
}

stop_port
[ "$STOP_ONLY" -eq 1 ] && exit 0

echo "Branch: $(git branch --show-current) @ $(git rev-parse --short HEAD)"
SYNC_ARGS=()
# Reinstall locked dependencies only when the lockfile changed since the last install.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  SYNC_ARGS=(--deps)
fi
scripts/dev-sync.sh "${SYNC_ARGS[@]}"

# Rebuild from scratch: the Turbopack dev cache can point into a node_modules tree
# that `npm ci` (dev-sync --deps, or a full preflight) has since replaced, which
# fails every page with "Cannot find module '@vercel/turbopack/postcss'".
rm -rf .next/dev

export TMPDIR=/tmp TMP=/tmp TEMP=/tmp
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
if command -v nvm >/dev/null 2>&1; then
  nvm use --silent >/dev/null || { echo "✗ Node from .nvmrc is unavailable — run: nvm install" >&2; exit 1; }
fi
exec npx next dev -p "$PORT"

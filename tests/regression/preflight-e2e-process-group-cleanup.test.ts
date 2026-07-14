// Regression test: full preflight killed only the npm wrapper after E2E.
//
// Found: 2026-07-14 after a successful full preflight left next-server on 3001.
// Root cause: scripts/preflight.sh recorded `$!` from `npm start` and killed only
// that wrapper PID. The descendant Next.js server survived under WSL init, and
// the next run's wait-on probe accepted that stale server after EADDRINUSE.
// The fix starts npm in an isolated process group and terminates the whole group.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

describe("preflight E2E process cleanup", () => {
  it("terminates a wrapper and its descendant through the production helper", () => {
    const harness = String.raw`
      set -Eeuo pipefail
      cd "$1"
      source scripts/lib/preflight-process-group.sh

      pidfile="$(mktemp)"
      wrapper_pid=""
      server_pgid=""
      cleanup_fixture() {
        if [ -n "$wrapper_pid" ] && [ -n "$server_pgid" ]; then
          preflight_terminate_process_group "$wrapper_pid" "$server_pgid" >/dev/null 2>&1 || true
        fi
        rm -f "$pidfile"
      }
      trap cleanup_fixture EXIT

      setsid bash -c 'sleep 300 & echo "$!" > "$1"; wait' fixture "$pidfile" &
      wrapper_pid=$!
      server_pgid="$(preflight_capture_process_group "$wrapper_pid")"

      for _ in $(seq 1 50); do
        [ -s "$pidfile" ] && break
        sleep 0.02
      done
      [ -s "$pidfile" ] || { echo "fixture descendant PID was not recorded" >&2; exit 1; }
      descendant_pid="$(cat "$pidfile")"
      kill -0 "$descendant_pid"

      preflight_terminate_process_group "$wrapper_pid" "$server_pgid"
      wrapper_pid=""
      server_pgid=""

      descendant_state="$(ps -o stat= -p "$descendant_pid" | tr -d '[:space:]' || true)"
      if [ -n "$descendant_state" ] && [[ "$descendant_state" != Z* ]]; then
        echo "descendant $descendant_pid survived cleanup with state $descendant_state" >&2
        exit 1
      fi
    `;

    const result = spawnSync("bash", ["-c", harness, "preflight-cleanup-test", REPO_ROOT], {
      encoding: "utf8",
      timeout: 15_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});

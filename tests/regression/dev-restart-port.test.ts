// Regression test (task 34eafcdf): restarting the dev server failed with EADDRINUSE.
//
// Root cause: the local restart launcher freed :3000 with `lsof -t -iTCP:3000
// -sTCP:LISTEN`. In WSL, lsof does not list Node's listening sockets, so it found
// nothing, killed nothing, and the new `next dev` could not bind the port while
// the old server kept serving the previous checkout. scripts/dev-restart.sh now
// finds the listener with `ss`, stops it together with its npm/next wrappers,
// waits for the port to close, and leaves any non-Next.js listener alone.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const hasSs = spawnSync("sh", ["-c", "command -v ss"]).status === 0;

// Starts a TCP listener on $PORT whose command line begins with $FIXTURE_NAME, runs
// `dev-restart.sh --stop-only`, and prints the result. The name travels in the
// environment so this harness's own command line never looks like a Next.js process.
const harness = String.raw`
  set -Eeuo pipefail
  cd "$1"
  export PORT="$(( 39000 + RANDOM % 900 ))"
  bash -c 'exec -a "$FIXTURE_NAME" node -e "require(\"net\").createServer().listen(+process.env.PORT)"' &
  listener=$!
  trap 'kill "$listener" 2>/dev/null || true' EXIT
  for _ in $(seq 1 100); do
    ss -H -ltn "sport = :$PORT" | grep -q . && break
    sleep 0.05
  done
  ss -H -ltn "sport = :$PORT" | grep -q . || { echo "fixture never listened" >&2; exit 2; }

  set +e
  scripts/dev-restart.sh --stop-only
  status=$?
  set -e
  if ss -H -ltn "sport = :$PORT" | grep -q .; then port=busy; else port=free; fi
  echo "status=$status port=$port"
`;

function run(fixtureName: string) {
  const result = spawnSync("bash", ["-c", harness, "dev-restart-test", REPO_ROOT], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, FIXTURE_NAME: fixtureName },
  });
  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return result;
}

describe.skipIf(process.platform !== "linux" || !hasSs)("dev-restart port handover", () => {
  it("stops a Next.js server on the port so a new one can bind it", () => {
    const { stdout } = run("next-server (v16)");
    expect(stdout).toContain("status=0 port=free");
  });

  it("refuses to stop a listener that is not a Next.js server", () => {
    const { stdout, stderr } = run("other-service");
    expect(stdout).toContain("status=1 port=busy");
    expect(stderr).toContain("not a Next.js dev server");
  });
});

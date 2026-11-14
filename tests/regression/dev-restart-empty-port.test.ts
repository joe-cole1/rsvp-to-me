// Root cause (01a1d8f5): grep returned 1 for an empty ss result. With pipefail
// and errexit, dev-restart stopped before syncing/starting when no server ran.
// Exercise the actual script with isolated commands so real listeners are safe.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("dev-restart on empty and occupied ports", () => {
  let fixture: string;
  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), "rsvp-dev-restart-"));
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "bin"));
    mkdirSync(join(fixture, "node_modules"));
    copyFileSync(resolve("scripts/dev-restart.sh"), join(fixture, "scripts/dev-restart.sh"));
    writeFileSync(join(fixture, "package-lock.json"), "{}");
    writeFileSync(join(fixture, "node_modules/.package-lock.json"), "{}");
    command("git", "echo fixture");
    command("npx", 'printf "START %s\\n" "$*"');
    writeFileSync(join(fixture, "scripts/dev-sync.sh"), "#!/bin/bash\necho SYNC\n", {
      mode: 0o755,
    });
    command("ss", "exit 0");
  });
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function command(name: string, body: string) {
    writeFileSync(join(fixture, "bin", name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  }
  function run(args: string[] = [], extra: Partial<NodeJS.ProcessEnv> = {}) {
    const result = spawnSync("bash", [join(fixture, "scripts/dev-restart.sh"), ...args], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
        NVM_DIR: join(fixture, "no-nvm"),
        PORT: "3000",
        ...extra,
      },
    });
    expect(result.error).toBeUndefined();
    return result;
  }

  it("syncs and starts Next.js when no server is listening", () => {
    const result = run();
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("SYNC");
    expect(result.stdout).toContain("START next dev -p 3000");
  });

  it("succeeds without syncing in stop-only mode on an empty port", () => {
    const result = run(["--stop-only"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/SYNC|START/);
  });

  it("reports socket inspection errors and does not start a second server", () => {
    command("ss", 'echo "fixture socket failure" >&2; exit 2');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fixture socket failure");
    expect(result.stdout).not.toMatch(/SYNC|START/);
  });

  it("leaves a non-Next.js listener alone", () => {
    command("ss", 'echo "LISTEN 0 511 *:3000 *:* users:((fixture,pid=987654,fd=1))"');
    command("ps", 'echo "unrelated-service"');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not a Next.js dev server");
    expect(result.stdout).not.toMatch(/SYNC|START/);
  });

  it("stops an existing Next.js process and then starts the replacement", async () => {
    const server = spawn("bash", ["-c", "exec -a next-server-fixture sleep 300"]);
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("spawn", resolve);
        server.once("error", reject);
      });
      command(
        "ss",
        String.raw`
        state="$(ps -o stat= -p "$FIXTURE_SERVER_PID" || true)"
        if [ -n "$state" ] && [[ "$state" != Z* ]]; then
          echo "LISTEN 0 511 *:3000 *:* users:((fixture,pid=$FIXTURE_SERVER_PID,fd=1))"
        fi
      `
      );
      const result = run([], { FIXTURE_SERVER_PID: String(server.pid) });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Stopping the Next.js server");
      expect(result.stdout).toContain("START next dev -p 3000");
    } finally {
      server.kill("SIGKILL");
    }
  });
});

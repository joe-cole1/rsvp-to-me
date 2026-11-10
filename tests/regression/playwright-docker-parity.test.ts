// #733 / #832: a second image pin drifted from the installed Playwright package.
// d4ae35f3: exercise both real shell entry points with independent package
// fixtures, so upgrades select their browser image without editing the test.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");
const checker = "scripts/check-playwright-docker.sh";
const runner = "scripts/run-e2e-docker.sh";
const resolver = "scripts/playwright-image.cjs";

function runFixture(entry: string, version: string | undefined, dockerStatus = 0) {
  const fixture = mkdtempSync(join(tmpdir(), "playwright-docker-parity-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "bin"));
    for (const script of [checker, runner, resolver]) {
      copyFileSync(join(ROOT, script), join(fixture, script));
    }
    const packageDir = join(fixture, "node_modules/@playwright/test");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ version }));
    writeFileSync(join(fixture, "bin/git"), '#!/bin/bash\nprintf "%s\\n" "$PWD"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(fixture, "bin/docker"),
      '#!/bin/bash\nprintf "%s\\n" "$@" > "$PWD/docker-args"\nexit "$FIXTURE_DOCKER_STATUS"\n',
      { mode: 0o755 }
    );
    const result = spawnSync("bash", [entry], {
      cwd: fixture,
      env: {
        ...process.env,
        PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
        FIXTURE_DOCKER_STATUS: String(dockerStatus),
      },
      encoding: "utf8",
      timeout: 5_000,
    });
    let dockerArgs: string[] | undefined;
    try {
      dockerArgs = readFileSync(join(fixture, "docker-args"), "utf8").trimEnd().split("\n");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { result, dockerArgs, fixture };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe.each([checker, runner])("Playwright image selected by %s", (entry) => {
  it.each(["1.64.1", "1.65.0", "2.0.0"])(
    "automatically follows installed Playwright %s",
    (version) => {
      const { result, dockerArgs } = runFixture(entry, version);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(dockerArgs).toContain(`mcr.microsoft.com/playwright:v${version}-noble`);
      expect(dockerArgs?.[0]).toBe("run");
    }
  );

  it.each([undefined, "not-a-version", "1.65.0-rc.1", "1.65.0;touch /tmp/unexpected"])(
    "rejects invalid or unpublished image versions: %s",
    (version) => {
      const { result, dockerArgs } = runFixture(entry, version);
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Cannot select a stable Playwright Docker image");
      expect(dockerArgs).toBeUndefined();
    }
  );

  it("propagates browser failures", () => {
    const { result, dockerArgs } = runFixture(entry, "1.65.0", 42);
    expect(result.error).toBeUndefined();
    expect(dockerArgs).toBeDefined();
    expect(result.status).toBe(42);
  });
});

it("uses an isolated read-only browser smoke test", () => {
  const { result, dockerArgs, fixture } = runFixture(checker, "1.65.0");
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(dockerArgs?.slice(0, 13)).toEqual([
    "run",
    "--rm",
    "--init",
    "--ipc=host",
    "--network",
    "none",
    "--volume",
    `${fixture}:/app:ro`,
    "--workdir",
    "/app",
    "mcr.microsoft.com/playwright:v1.65.0-noble",
    "node",
    "-e",
  ]);
});

it("runs the browser gate in CI and before preflight's fast-mode exit", () => {
  const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const preflight = readFileSync(join(ROOT, "scripts/preflight.sh"), "utf8");
  const browserStep = ci.split("- name: Verify Playwright Docker browser")[1]?.split("- name:")[0];
  expect(browserStep).toContain(checker);
  const invocation = preflight.indexOf(`\n${checker}\n`);
  expect(invocation).toBeGreaterThan(preflight.indexOf('ok "deps ready"'));
  expect(invocation).toBeLessThan(preflight.indexOf('if [ "$FAST" = 1 ]'));
});

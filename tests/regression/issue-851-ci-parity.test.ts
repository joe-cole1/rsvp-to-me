// #851: CI fixed/pushed the tree before validating it, retried E2E only in CI,
// omitted rich E2E seeds, and tested an older Redis than deployments used.
// Compose also overrode operators' explicit SEED_TEST_DATA=false setting.
// CodeQL follow-up: the custom PR-head checkout was flagged in this workflow's
// cache-write-capable manual-trigger path. Use the event's default checkout;
// preserve manual runs, PR integration checks and every existing cache.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { load } = createRequire(import.meta.url)("js-yaml") as { load: (yaml: string) => unknown };
type Step = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};
const ci = load(readFileSync(resolve(".github/workflows/ci.yml"), "utf8")) as {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: { ci: { steps: Step[]; permissions?: Record<string, string> } };
};
const steps = ci.jobs.ci.steps;
const preflight = readFileSync(resolve("scripts/preflight.sh"), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("#851 CI validates the submitted tree", () => {
  it("uses the event checkout without a custom PR-controlled revision", () => {
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout).toBeDefined();
    expect(checkout?.with).not.toHaveProperty("ref");
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  it("retains manual runs, PR and main-push validation, and all three caches", () => {
    expect(ci.on).toHaveProperty("workflow_dispatch");
    expect(ci.on.pull_request).toEqual(expect.objectContaining({ branches: ["main"] }));
    expect(ci.on.push).toEqual(expect.objectContaining({ branches: ["main"] }));
    expect(steps.find((step) => step.uses?.startsWith("actions/setup-node@"))?.with?.cache).toBe(
      "npm"
    );
    const cachePaths = steps
      .filter((step) => step.uses?.startsWith("actions/cache@"))
      .map((step) => step.with?.path)
      .filter((path): path is string => typeof path === "string")
      .map((path) => path.replace(/^\$\{\{\s*github\.workspace\s*\}\}\//, ""));
    expect(cachePaths).toEqual(expect.arrayContaining(["~/.cache/ms-playwright", ".next/cache"]));
  });

  it("has read-only permissions and never runs fix/stage/commit/push operations", () => {
    expect(ci.permissions).toEqual({ contents: "read" });
    expect(ci.jobs.ci.permissions).toBeUndefined();
    expect(steps.find((step) => step.with?.["persist-credentials"] === false)).toBeDefined();
    const commands = steps.map((step) => step.run ?? "").join("\n");
    expect(commands).not.toMatch(
      /--(?:write|fix)\b|\bprisma format\b|\bgit (?:add|commit|push|checkout)\b/
    );
    expect(steps.some((step) => step.run === "bash scripts/check-format.sh")).toBe(true);
    expect(preflight).toContain("bash scripts/check-format.sh");
    expect(steps.some((step) => step.run === "npm run lint")).toBe(true);
    expect(preflight).toContain("npm run lint");
  });

  it.each([undefined, "true"])("does not retry failing E2E cases with CI=%s", async (ciValue) => {
    vi.stubEnv("CI", ciValue);
    const { default: config } = await import("../../playwright.config");
    expect(config.retries).toBe(0);
  });

  it("seeds the same explicit rich fixtures before starting the E2E server", () => {
    const seed = steps.findIndex((step) => step.run === "SEED_TEST_DATA=true npm run db:seed");
    const start = steps.findIndex((step) => step.run === "npm start &");
    expect(seed).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(seed);
    expect(steps[seed].env?.DATABASE_URL).toBe(steps[start].env?.DATABASE_URL);
    expect(steps[seed].env?.HOST_INVITE_CODE).toBe(steps[start].env?.HOST_INVITE_CODE);
    expect(preflight).toContain("SEED_TEST_DATA=true npm run db:seed");
  });

  it("resolves the deployment Redis image in both gates", () => {
    expect(
      steps.some((step) => step.run?.includes("node scripts/compose-service-image.cjs redis"))
    ).toBe(true);
    expect(preflight).toContain("node scripts/compose-service-image.cjs redis");
    expect(steps.map((step) => step.run).join("\n")).not.toMatch(/redis:\d/);
    expect(preflight).not.toMatch(/redis:\d/);
  });

  it("preserves the operator's sample-data choice in the source-build Compose file", () => {
    const compose = load(readFileSync(resolve("docker-compose.yml"), "utf8")) as {
      services: { app: { environment: Record<string, unknown>; env_file: string } };
    };
    expect(compose.services.app.env_file).toBe(".env");
    expect(compose.services.app.environment).not.toHaveProperty("SEED_TEST_DATA");
  });
});

describe("deployment service image resolver", () => {
  function runWithConfig(config: unknown, status = 0) {
    const fixture = mkdtempSync(join(tmpdir(), "rsvp-service-image-"));
    try {
      mkdirSync(join(fixture, "bin"));
      writeFileSync(join(fixture, "config.json"), JSON.stringify(config));
      writeFileSync(
        join(fixture, "bin/docker"),
        '#!/bin/bash\nprintf "%s\\n" "$@" > "$FIXTURE_ARGS"\ncat "$FIXTURE_CONFIG"\nexit "$FIXTURE_STATUS"\n',
        { mode: 0o755 }
      );
      const result = spawnSync(
        process.execPath,
        [resolve("scripts/compose-service-image.cjs"), "redis"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
            FIXTURE_ARGS: join(fixture, "args"),
            FIXTURE_CONFIG: join(fixture, "config.json"),
            FIXTURE_STATUS: String(status),
          },
        }
      );
      expect(result.error).toBeUndefined();
      return { ...result, args: readFileSync(join(fixture, "args"), "utf8").trim().split("\n") };
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }

  it.each(["redis:9-alpine", "registry.example/redis:10.2", `redis@sha256:${"a".repeat(64)}`])(
    "accepts a deployment image update to %s without another version pin",
    (image) => {
      const result = runWithConfig({ services: { redis: { image } } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(image);
      expect(result.args).toEqual([
        "compose",
        "-f",
        "docker-compose.yml",
        "config",
        "--no-interpolate",
        "--no-env-resolution",
        "--format",
        "json",
      ]);
    }
  );

  it.each([
    {},
    { services: { redis: { image: "${REDIS_IMAGE}" } } },
    { services: { redis: { image: "" } } },
  ])("fails closed for a missing/unresolved image", (config) => {
    const result = runWithConfig(config);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("does not expose Compose configuration on failure", () => {
    const result = runWithConfig(
      {
        services: {
          redis: { image: "redis:future", environment: { SECRET: "fixture-private-value" } },
        },
      },
      1
    );
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("fixture-private-value");
  });
});

describe("shared formatting gate", () => {
  it.each([0, 1])("checks without modifying files and preserves formatter exit %s", (status) => {
    const fixture = mkdtempSync(join(tmpdir(), "rsvp-format-check-"));
    try {
      mkdirSync(join(fixture, "bin"));
      const source = "export const fixture = 1;\n";
      writeFileSync(join(fixture, "file with spaces.ts"), source);
      writeFileSync(
        join(fixture, "bin/git"),
        String.raw`#!/bin/bash
if [ "$1" = rev-parse ]; then
  echo "$FIXTURE_ROOT"
else
  printf '%s\0' 'file with spaces.ts' 'deleted.ts'
fi
`,
        { mode: 0o755 }
      );
      writeFileSync(
        join(fixture, "bin/npx"),
        String.raw`#!/bin/bash
printf '%s\0' "$@" > "$FIXTURE_ROOT/format-args"
exit "$FIXTURE_STATUS"
`,
        { mode: 0o755 }
      );
      const result = spawnSync("bash", [resolve("scripts/check-format.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
          FIXTURE_ROOT: fixture,
          FIXTURE_STATUS: String(status),
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.status === 0, result.stderr).toBe(status === 0);
      const args = readFileSync(join(fixture, "format-args"), "utf8").split("\0").filter(Boolean);
      expect(args).toContain("--check");
      expect(args).not.toContain("--write");
      expect(args).toContain("file with spaces.ts");
      expect(args).not.toContain("deleted.ts");
      expect(readFileSync(join(fixture, "file with spaces.ts"), "utf8")).toBe(source);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});

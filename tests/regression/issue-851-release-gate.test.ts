// #851: release publishing had no prerequisite validation for its commit.
// Reuse the actual CI/container workflows at the caller commit; checked-out
// SHA mismatches, skipped jobs and failed jobs must block publication.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const { load } = createRequire(import.meta.url)("js-yaml") as { load: (yaml: string) => unknown };
type Step = {
  name?: string;
  run?: string;
  uses?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  "continue-on-error"?: boolean;
};
type Job = {
  if?: string;
  needs?: string[];
  uses?: string;
  steps?: Step[];
  permissions?: Record<string, string>;
  "continue-on-error"?: boolean;
  strategy?: { matrix: { include: { arch: string }[] } };
};
type Workflow = {
  on: Record<string, unknown>;
  concurrency?: { group: string };
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};
function workflow(name: string) {
  return load(readFileSync(`.github/workflows/${name}.yml`, "utf8")) as Workflow;
}
const release = workflow("release");

describe("#851 release requires exact-commit validation", () => {
  it("requires both successful reusable workflows before the only package-write job", () => {
    expect(release.jobs.docker.needs).toEqual(["validate-ci", "validate-container"]);
    expect(release.jobs["validate-ci"].uses).toBe("./.github/workflows/ci.yml");
    expect(release.jobs["validate-container"].uses).toBe("./.github/workflows/container-qc.yml");
    expect(release.permissions).toEqual({ contents: "read" });
    for (const [name, job] of Object.entries(release.jobs)) {
      expect(job.if).toContain("github.actor == github.repository_owner");
      expect(job.if).toContain("github.triggering_actor == github.repository_owner");
      expect(job.if).not.toMatch(/always\(|failure\(|cancelled\(/);
      expect(job["continue-on-error"]).not.toBe(true);
      expect(job.permissions?.packages).toBe(name === "docker" ? "write" : undefined);
    }
  });

  it("keeps manual runs and both native architectures, with distinct concurrency groups", () => {
    const ci = workflow("ci");
    const qc = workflow("container-qc");
    for (const current of [ci, qc]) {
      expect(current.on).toHaveProperty("workflow_call");
      expect(current.on).toHaveProperty("workflow_dispatch");
    }
    // github.workflow is the caller's name for both reused workflows.
    expect(ci.concurrency?.group).not.toBe(qc.concurrency?.group);
    expect(qc.jobs.container.strategy?.matrix.include.map((row) => row.arch)).toEqual([
      "amd64",
      "arm64",
    ]);
    const push = release.jobs.docker.steps?.find((step) =>
      step.uses?.startsWith("docker/build-push-action@")
    );
    expect(push?.with?.platforms).toBe("linux/amd64,linux/arm64");
    expect(push?.with?.push).toBe(true);
  });

  it.each(["ci", "container-qc", "release"])(
    "%s verifies the event SHA before any validation/publication",
    (name) => {
      const current = workflow(name);
      const job = current.jobs[name === "ci" ? "ci" : name === "release" ? "docker" : "container"];
      const steps = job.steps!;
      const checkout = steps.findIndex((step) => step.uses?.startsWith("actions/checkout@"));
      expect(steps[checkout].with?.ref).toBeUndefined();
      expect(steps[checkout].with?.["persist-credentials"]).toBe(false);
      const guard = steps[checkout + 1];
      expect(guard.env?.EXPECTED_SHA).toBe("${{ github.sha }}");
      expect(guard.if).toBeUndefined();
      expect(guard["continue-on-error"]).not.toBe(true);
      expect(guard.run).toBeTruthy();
      const fixture = mkdtempSync(join(tmpdir(), "rsvp-release-sha-"));
      try {
        writeFileSync(join(fixture, "git"), '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_SHA"\n', {
          mode: 0o755,
        });
        for (const [actual, expected, passes] of [
          ["a".repeat(40), "a".repeat(40), true],
          ["b".repeat(40), "a".repeat(40), false],
          ["", "a".repeat(40), false],
        ]) {
          const result = spawnSync("bash", ["-e", "-c", guard.run!], {
            env: {
              ...process.env,
              PATH: `${fixture}:${process.env.PATH}`,
              FIXTURE_SHA: String(actual),
              EXPECTED_SHA: String(expected),
            },
          });
          expect(result.status === 0).toBe(passes);
        }
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    }
  );
});

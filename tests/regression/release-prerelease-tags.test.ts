// September 2026 release prep: an unconditional latest rule let prereleases
// overwrite the stable image. Guard both prerelease signals and the workflow
// wiring; metadata-action's implicit latest must also stay disabled.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const requireScript = createRequire(import.meta.url);
type Release = { tag_name: string; prerelease: boolean; draft: boolean };
const { releaseImageTags } = requireScript("../../scripts/release-image-tags.cjs") as {
  releaseImageTags: (release: Partial<Release> | null) => string[];
};
const { load } = requireScript("js-yaml") as { load: (source: string) => unknown };
const published = (tag_name: string, prerelease = false): Release => ({
  tag_name,
  prerelease,
  draft: false,
});

describe("release image tag isolation", () => {
  it("preserves the stable version, minor and latest aliases", () => {
    expect(releaseImageTags(published("v1.4.1"))).toEqual(["1.4.1", "1.4", "latest"]);
  });

  it.each([
    ["v1.4.1-rc.1", true, "1.4.1-rc.1"],
    ["v1.4.1-rc.1", false, "1.4.1-rc.1"],
    ["v1.4.1", true, "1.4.1"],
    ["v2.0.0-beta.0", false, "2.0.0-beta.0"],
  ])("isolates %s with prerelease=%s", (tag, prerelease, expected) => {
    expect(releaseImageTags(published(tag, prerelease))).toEqual([expected]);
  });

  it.each([
    "main",
    "v1.4",
    "v01.4.1",
    "v1.4.1-rc.01",
    "v1.4.1+build.1",
    "v1.4.1\ntype=raw,value=latest",
    `v1.4.1-${"x".repeat(128)}`,
  ])("rejects unsupported or ambiguous tag %s", (tag) => {
    expect(() => releaseImageTags(published(tag))).toThrow();
  });

  it("fails closed for missing flags, missing releases and drafts", () => {
    for (const release of [null, { tag_name: "v1.4.1" }, { ...published("v1.4.1"), draft: true }]) {
      expect(() => releaseImageTags(release)).toThrow();
    }
  });

  it("writes only candidate rules through the actual Actions entrypoint", () => {
    const directory = mkdtempSync(join(tmpdir(), "rsvp-release-tags-"));
    try {
      const event = join(directory, "event.json");
      const output = join(directory, "output");
      writeFileSync(event, JSON.stringify({ release: published("v1.4.1-rc.1", false) }));
      execFileSync(process.execPath, [join(root, "scripts/release-image-tags.cjs")], {
        env: { ...process.env, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output },
        timeout: 5000,
      });
      expect(readFileSync(output, "utf8")).toBe(
        "tags<<RSVP_RELEASE_TAGS\ntype=raw,value=1.4.1-rc.1\nRSVP_RELEASE_TAGS\n"
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses only policy tags and disables metadata-action's automatic latest", () => {
    type Step = { id?: string; run?: string; uses?: string; with?: Record<string, string> };
    const workflow = load(readFileSync(join(root, ".github/workflows/release.yml"), "utf8")) as {
      jobs: { docker: { if: string; steps: Step[] } };
    };
    const { steps } = workflow.jobs.docker;
    expect(steps.find((step) => step.id === "release-tags")?.run).toBe(
      "node scripts/release-image-tags.cjs"
    );
    const metadata = steps.find((step) => step.id === "meta");
    expect(metadata?.with?.flavor).toBe("latest=false");
    expect(metadata?.with?.tags).toBe("${{ steps.release-tags.outputs.tags }}");
    const push = steps.find((step) => step.uses?.startsWith("docker/build-push-action@"));
    expect(push?.with?.tags).toBe("${{ steps.meta.outputs.tags }}");
    expect(workflow.jobs.docker.if).toContain("github.actor == github.repository_owner");
    expect(workflow.jobs.docker.if).toContain("github.triggering_actor == github.repository_owner");
  });
});

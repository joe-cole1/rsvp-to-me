import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShipFixture, shipBranch, type ShipFixture } from "@/tests/helpers/ship-fixture";

let fixture: ShipFixture;

beforeEach(() => {
  fixture = createShipFixture();
});

afterEach(() => {
  if (fixture) rmSync(fixture.directory, { recursive: true, force: true });
});

describe("preflight pass stamps", () => {
  it("identify the working tree's content, including untracked files but not ignored ones", () => {
    const before = fixture.treeId();
    expect(before).toMatch(/^[0-9a-f]{40}$/);
    expect(fixture.treeId()).toBe(before);

    fixture.write(".gitignore", "ignored.log\n");
    const withIgnoreFile = fixture.treeId();
    expect(withIgnoreFile).not.toBe(before);

    fixture.write("ignored.log", "noise\n");
    expect(fixture.treeId()).toBe(withIgnoreFile);

    fixture.write("new-file.txt", "untracked\n");
    expect(fixture.treeId()).not.toBe(withIgnoreFile);
  });

  it("never touch the real index", () => {
    fixture.treeId();
    expect(fixture.git(["diff", "--cached", "--name-only"])).toBe("");
  });

  it("let a full pass cover fast, but not a fast pass cover full", () => {
    const covers = (mode: string) =>
      fixture.bash(
        '. scripts/lib/preflight-stamp.sh && preflight_stamp_covers "$1" "$(preflight_tree_id)"',
        [mode]
      ).status;

    fixture.recordPass("fast");
    expect(covers("fast")).toBe(0);
    expect(covers("full")).toBe(1);

    fixture.recordPass("full");
    expect([covers("fast"), covers("full")]).toEqual([0, 0]);

    // A later fast pass on the same tree keeps the stronger full stamp.
    fixture.recordPass("fast");
    expect(covers("full")).toBe(0);
  });
});

describe("ship.sh reuses a passing preflight", () => {
  it("skips preflight when this exact tree already passed", () => {
    fixture.recordPass("full");
    const result = fixture.ship({ options: ["--pr-handoff", "--fast"] });
    expect(result.status, result.output).toBe(0);
    expect(fixture.readLog("preflight-args")).toBe("");
    expect(result.output).toContain("already passed for this exact working tree");
  });

  it("runs preflight when a fast pass is all there is and full is requested", () => {
    fixture.recordPass("fast");
    const result = fixture.ship();
    expect(result.status, result.output).toBe(0);
    expect(fixture.readLog("preflight-args")).toBe("\n");
  });

  it("runs preflight when the tree changed after the recorded pass", () => {
    fixture.recordPass("full");
    fixture.write("reviewed.txt", "changed again\n");
    const result = fixture.ship({ options: ["--pr-handoff", "--fast"] });
    expect(result.status, result.output).toBe(0);
    expect(fixture.readLog("preflight-args")).toBe("--fast\n");
  });

  it("runs preflight again with --rerun-preflight", () => {
    fixture.recordPass("full");
    const result = fixture.ship({ options: ["--pr-handoff", "--fast", "--rerun-preflight"] });
    expect(result.status, result.output).toBe(0);
    expect(fixture.readLog("preflight-args")).toBe("--fast\n");
  });
});

describe("ship.sh retries transient network failures", () => {
  it("retries gh pr create after a DNS failure and opens the PR", () => {
    fixture.installGh("new");
    fixture.env.SHIP_TEST_GH_CREATE_FAILS = "network:2";
    const result = fixture.ship({ options: ["--fast"] });
    expect(result.status, result.output).toBe(0);
    expect(fixture.ghCalls().filter((call) => call[1] === "create")).toHaveLength(3);
    expect(result.output).toContain("Network error (attempt 1 of 3)");
    expect(result.output).toContain(`✅ Shipped: ${shipBranch}`);
  });

  it("stops after the last attempt", () => {
    fixture.installGh("new");
    fixture.env.SHIP_TEST_GH_CREATE_FAILS = "network:9";
    const result = fixture.ship({ options: ["--fast"] });
    expect(result.status).toBe(1);
    expect(fixture.ghCalls().filter((call) => call[1] === "create")).toHaveLength(3);
    expect(result.output).not.toContain("✅ Shipped");
  });

  it("does not retry a failure that is not a network error", () => {
    fixture.installGh("new");
    fixture.env.SHIP_TEST_GH_CREATE_FAILS = "fatal";
    const result = fixture.ship({ options: ["--fast"] });
    expect(result.status).toBe(1);
    expect(fixture.ghCalls().filter((call) => call[1] === "create")).toHaveLength(1);
    expect(result.output).toContain("Validation Failed");
    expect(result.output).not.toContain("Network error");
  });
});

describe("ship.sh --committed", () => {
  function commitReviewed() {
    fixture.git(["add", "--", "reviewed.txt"]);
    fixture.git(["commit", "-m", "first fix"]);
    fixture.write("unreviewed.txt", "second fix\n");
    fixture.git(["add", "--", "unreviewed.txt"]);
    fixture.git(["commit", "-m", "second fix"]);
  }

  it("pushes existing commits and opens the PR without a new commit or formatting", () => {
    commitReviewed();
    const head = fixture.git(["rev-parse", "HEAD"]);
    fixture.installGh("new");
    const result = fixture.ship({
      message: "[baf40c62] fix: two separate fixes",
      options: ["--committed", "--fast", "--label", "bug"],
      files: null,
    });
    expect(result.status, result.output).toBe(0);
    expect(fixture.git(["rev-parse", "HEAD"])).toBe(head);
    expect(
      fixture.git(["--git-dir", fixture.origin, "rev-parse", `refs/heads/${shipBranch}`])
    ).toBe(head);
    expect(fixture.readLog("format-args")).toBe("");
    expect(fixture.readLog("preflight-args")).toBe("--fast\n");
    const create = fixture.ghCalls().find((call) => call[1] === "create");
    expect(create).toContain("[baf40c62] fix: two separate fixes");
  });

  it("refuses uncommitted changes", () => {
    commitReviewed();
    fixture.write("reviewed.txt", "not committed\n");
    const result = fixture.ship({ options: ["--committed", "--pr-handoff"], files: null });
    expect(result.status).toBe(1);
    expect(result.output).toContain("working tree has uncommitted changes");
    expect(fixture.git(["ls-remote", "--heads", "origin", shipBranch])).toBe("");
  });

  it("refuses a branch with nothing ahead of the base", () => {
    fixture.git(["checkout", "--", "reviewed.txt"]);
    const result = fixture.ship({ options: ["--committed", "--pr-handoff"], files: null });
    expect(result.status).toBe(1);
    expect(result.output).toContain("No commits ahead of origin/main");
    fixture.expectUnshipped();
  });

  it("refuses files listed after --", () => {
    commitReviewed();
    const result = fixture.ship({ options: ["--committed", "--pr-handoff"] });
    expect(result.status).toBe(1);
    expect(result.output).toContain("--committed ships existing commits");
  });

  it("applies the self-review guards to the committed diff", () => {
    fixture.write(".env", "EXAMPLE=fixture-only\n");
    fixture.git(["add", "--", "reviewed.txt", ".env"]);
    fixture.git(["commit", "-m", "commits a secret"]);
    const result = fixture.ship({ options: ["--committed", "--pr-handoff"], files: null });
    expect(result.status).toBe(1);
    expect(result.output).toContain("A .env file is staged");
    expect(fixture.git(["ls-remote", "--heads", "origin", shipBranch])).toBe("");
  });

  it("still requires reviewed files without --committed", () => {
    const result = fixture.ship({ files: null });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Provide the reviewed files after --");
    expect(result.output).toContain("--committed");
  });
});

describe("net_retry", () => {
  it("passes stdout through so callers can capture it", () => {
    writeFileSync(join(fixture.directory, "out.txt"), "value\n");
    const result = fixture.bash(
      '. scripts/lib/net-retry.sh && x="$(net_retry cat "$1")" && echo "[$x]"',
      [join(fixture.directory, "out.txt")]
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("[value]\n");
  });
});

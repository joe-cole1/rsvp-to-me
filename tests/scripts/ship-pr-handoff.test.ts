import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createShipFixture as createFixture,
  shipBranch as branch,
  shipMessage as message,
  shipPrUrl as prUrl,
} from "@/tests/helpers/ship-fixture";

describe("ship.sh PR handoff", () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    if (fixture) rmSync(fixture.directory, { recursive: true, force: true });
  });

  it.each([false, true])(
    "commits reviewed paths and hands off with a forbidden gh shim: %s",
    (withGh) => {
      if (withGh) fixture.installGh("forbidden");
      const options = [
        "--pr-handoff",
        "--label",
        "tests",
        ...(withGh ? ["--fast", "--draft"] : []),
      ];
      const result = fixture.ship({ options });

      expect(result.status, result.output).toBe(0);
      expect(fixture.git(["log", "-1", "--format=%s"])).toBe(message);
      expect(fixture.git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])).toBe(
        "reviewed.txt"
      );
      expect(fixture.git(["status", "--porcelain"])).toBe("");
      expect(fixture.git(["rev-parse", "--abbrev-ref", "@{upstream}"])).toBe(`origin/${branch}`);
      expect(fixture.git(["--git-dir", fixture.origin, "rev-parse", `refs/heads/${branch}`])).toBe(
        fixture.git(["rev-parse", "HEAD"])
      );
      expect(fixture.readLog("format-args")).toBe(
        "prettier\n--write\n--ignore-unknown\nreviewed.txt\n"
      );
      expect(fixture.readLog("preflight-args")).toBe(withGh ? "--fast\n" : "\n");
      expect(fixture.ghCalls()).toEqual([]);
      expect(result.output).toContain("PR state was not checked (open, closed, or merged)");
      for (const field of [
        "Base: main",
        `Head: ${branch}`,
        `Title: ${message}`,
        "Label: tests",
        `Body file: ${fixture.body}`,
        `Draft flag: ${withGh ? "--draft" : "(none)"}`,
      ]) {
        expect(result.output).toContain(field);
      }
      expect(result.output).toContain("Pushed; PR handoff required");
      expect(result.output).not.toContain("✅ Shipped:");
    }
  );

  it.each(["unreviewed.txt", "untracked.txt"])("blocks an unreviewed file: %s", (path) => {
    fixture.write(path, "unreviewed change\n");
    const result = fixture.ship();
    expect(result.status).toBe(1);
    expect(result.output).toContain("Unstaged changes remain");
    expect(result.output).toContain(path);
    fixture.expectUnshipped();
  });

  it.each([
    [".env", "EXAMPLE=fixture-only\n", "A .env file is staged"],
    // Keep the fixture's focused call out of this suite's own staged source.
    [
      "tests/example.test.ts",
      `${["test", "only"].join(".")}("example", () => {});\n`,
      "A .only() is staged",
    ],
    [
      "app/example.ts",
      '  console.log("debug");\n',
      "A console.log/console.debug/debugger is staged",
    ],
  ])("preserves the staged-content guard for %s", (path, content, error) => {
    fixture.write(path, content);
    const result = fixture.ship({ files: ["reviewed.txt", path] });
    expect(result.status).toBe(1);
    expect(result.output).toContain(error);
    fixture.expectUnshipped();
  });

  it("blocks pre-existing staged changes", () => {
    fixture.write("unreviewed.txt", "already staged\n");
    fixture.git(["add", "--", "unreviewed.txt"]);
    const result = fixture.ship();
    expect(result.status).toBe(1);
    expect(result.output).toContain("The index already contains staged changes");
    expect(fixture.readLog("format-args")).toBe("");
    fixture.expectUnshipped();
  });

  it.each([false, true])("requires a body file even when --allow-open-pr is %s", (allowOpen) => {
    const result = fixture.ship({
      options: ["--pr-handoff", ...(allowOpen ? ["--allow-open-pr"] : [])],
      bodyFile: null,
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("--pr-handoff requires --pr-body-file");
    expect(result.output).toContain("PR state was not checked");
    if (allowOpen) expect(result.output).toContain("--allow-open-pr cannot enforce");
    expect(fixture.readLog("format-args")).toBe("");
    fixture.expectUnshipped();
  });

  it.each(["## Summary", "## Verification", "## Documentation"])(
    "requires the body heading %s even with --allow-open-pr",
    (heading) => {
      writeFileSync(
        fixture.body,
        readFileSync(fixture.body, "utf8").replace(heading, "Missing heading")
      );
      const result = fixture.ship({ options: ["--pr-handoff", "--allow-open-pr"] });
      expect(result.status).toBe(1);
      expect(result.output).toContain(`PR body must contain the heading: ${heading}`);
      expect(fixture.readLog("format-args")).toBe("");
      fixture.expectUnshipped();
    }
  );

  it("rejects an unreadable body file before formatting", () => {
    const result = fixture.ship({ bodyFile: join(fixture.directory, "missing.md") });
    expect(result.status).toBe(1);
    expect(result.output).toContain("PR body file is not readable");
    expect(fixture.readLog("format-args")).toBe("");
    fixture.expectUnshipped();
  });

  it("preserves the base-branch guard", () => {
    const result = fixture.ship({ options: ["--pr-handoff", "--base", branch] });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Refusing to ship from the base branch");
    fixture.expectUnshipped();
  });

  it("preserves release-label validation", () => {
    const result = fixture.ship({ options: ["--pr-handoff", "--label", "unsupported"] });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Unsupported release label");
    fixture.expectUnshipped();
  });

  it("does not stage, commit, push, or print a handoff when preflight fails", () => {
    fixture.env.SHIP_TEST_PREFLIGHT_STATUS = "42";
    const result = fixture.ship();
    expect(result.status).toBe(42);
    expect(fixture.git(["diff", "--cached", "--name-only"])).toBe("");
    expect(result.output).not.toContain("PR handoff required");
    fixture.expectUnshipped();
  });

  it("prints no handoff when the remote rejects the push", () => {
    writeFileSync(join(fixture.origin, "hooks/pre-receive"), "#!/bin/sh\nexit 1\n", {
      mode: 0o755,
    });
    const result = fixture.ship();
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("pre-receive hook declined");
    expect(result.output).not.toContain("PR handoff required");
    expect(fixture.git(["ls-remote", "--heads", "origin", branch])).toBe("");
  });

  it("still requires gh in normal mode", () => {
    const result = fixture.ship({ options: [] });
    expect(result.status).toBe(1);
    expect(result.output).toContain("GitHub CLI (gh) is required to check and open the PR.");
    expect(fixture.readLog("format-args")).toBe("");
    fixture.expectUnshipped();
  });

  it("still creates a PR with the requested metadata in normal mode", () => {
    fixture.installGh("new");
    const result = fixture.ship({
      options: ["--fast", "--draft", "--label", "tests", "--base", "main"],
    });
    expect(result.status, result.output).toBe(0);
    expect(fixture.ghCalls()).toEqual([
      ["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--jq", ".[0].url"],
      ["pr", "view", branch],
      [
        "pr",
        "create",
        "--base",
        "main",
        "--head",
        branch,
        "--title",
        message,
        "--body-file",
        fixture.body,
        "--label",
        "tests",
        "--draft",
      ],
    ]);
    expect(result.output).toContain(`✅ Shipped: ${branch}`);
    expect(result.output).not.toContain("PR state was not checked");
  });

  it("still blocks an open PR without --allow-open-pr in normal mode", () => {
    fixture.installGh("open");
    const result = fixture.ship({ options: [] });
    expect(result.status).toBe(1);
    expect(result.output).toContain(`This branch already has an open PR: ${prUrl}`);
    expect(fixture.ghCalls()).toHaveLength(1);
    fixture.expectUnshipped();
  });

  it("still reports an allowed open PR without requiring a body file in normal mode", () => {
    fixture.installGh("open");
    const result = fixture.ship({ options: ["--allow-open-pr"], bodyFile: null });
    expect(result.status, result.output).toBe(0);
    expect(fixture.ghCalls()).toEqual([
      ["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--jq", ".[0].url"],
      ["pr", "view", branch],
      ["pr", "view", branch, "--json", "url", "--jq", ".url"],
    ]);
    expect(result.output).toContain("PR already open:");
    expect(result.output).toContain(prUrl);
  });
});

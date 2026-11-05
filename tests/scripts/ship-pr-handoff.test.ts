import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = join(__dirname, "../../scripts/ship.sh");
const branch = "codex/chore-baf40c62-ship-test";
const message = "[baf40c62] chore(scripts): test PR handoff";
const prUrl = "https://github.com/example/fixture/pull/1";
const tools = Object.fromEntries(
  ["bash", "git", "grep"].map((name) => [
    name,
    execFileSync("bash", ["-c", 'command -v "$1"', "ship-test", name], {
      encoding: "utf8",
    }).trim(),
  ])
);

function createFixture() {
  const directory = mkdtempSync("/tmp/rsvp-ship-handoff-");
  const repository = join(directory, "repo");
  const origin = join(directory, "origin.git");
  const bin = join(directory, "bin");
  const body = join(directory, "pr body.md");
  mkdirSync(repository);
  mkdirSync(bin);
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PATH: bin,
    NVM_DIR: join(directory, "no-nvm"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    SHIP_TEST_DIRECTORY: directory,
  };

  for (const [name, executable] of Object.entries(tools)) {
    symlinkSync(executable, join(bin, name));
  }
  symlinkSync(process.execPath, join(bin, "node"));
  writeFileSync(
    join(bin, "npx"),
    '#!/bin/bash\nprintf "%s\\n" "$@" > "$SHIP_TEST_DIRECTORY/format-args"\n',
    { mode: 0o755 }
  );

  function write(path: string, content: string) {
    const target = join(repository, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  function git(args: string[]) {
    return execFileSync(tools.git, args, {
      cwd: repository,
      env,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }

  git(["init", "--bare", "--initial-branch=main", origin]);
  git(["init", "--initial-branch=main"]);
  git(["config", "user.name", "Ship test"]);
  git(["config", "user.email", "ship-test@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.hooksPath", "/dev/null"]);
  mkdirSync(join(repository, "scripts"));
  copyFileSync(script, join(repository, "scripts/ship.sh"));
  writeFileSync(
    join(repository, "scripts/preflight.sh"),
    '#!/bin/bash\nprintf "%s\\n" "$@" > "$SHIP_TEST_DIRECTORY/preflight-args"\nexit "${SHIP_TEST_PREFLIGHT_STATUS:-0}"\n',
    { mode: 0o755 }
  );
  write("reviewed.txt", "before\n");
  write("unreviewed.txt", "before\n");
  writeFileSync(
    body,
    "## Summary\n\nTooling feature.\n\n## Verification\n\nTests.\n\n## Documentation\n\nUpdated.\n"
  );
  git(["add", "--", "scripts/ship.sh", "scripts/preflight.sh", "reviewed.txt", "unreviewed.txt"]);
  git(["commit", "-m", "fixture baseline"]);
  git(["remote", "add", "origin", origin]);
  git(["push", "origin", "main"]);
  git(["switch", "-c", branch]);
  const initialHead = git(["rev-parse", "HEAD"]);
  write("reviewed.txt", "after\n");

  function installGh(mode: "forbidden" | "new" | "open") {
    env.SHIP_TEST_GH_MODE = mode;
    writeFileSync(
      join(bin, "gh"),
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.env.SHIP_TEST_DIRECTORY, "gh-calls"), JSON.stringify(args) + "\\n");
const mode = process.env.SHIP_TEST_GH_MODE;
if (mode === "forbidden") process.exit(97);
if (args[0] !== "pr") process.exit(98);
switch (args[1]) {
  case "list":
    if (mode === "open") process.stdout.write(${JSON.stringify(prUrl)} + "\\n");
    break;
  case "view":
    if (mode !== "open") process.exit(1);
    process.stdout.write(${JSON.stringify(prUrl)} + "\\n");
    break;
  case "create":
    process.stdout.write(${JSON.stringify(prUrl)} + "\\n");
    break;
  default:
    process.exit(99);
}
`,
      { mode: 0o755 }
    );
  }

  function readLog(name: string) {
    const path = join(directory, name);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }

  function ghCalls(): string[][] {
    return readLog("gh-calls")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]);
  }

  function ship({
    options = ["--pr-handoff"],
    files = ["reviewed.txt"],
    bodyFile = body,
  }: { options?: string[]; files?: string[]; bodyFile?: string | null } = {}) {
    const result = spawnSync(
      tools.bash,
      [
        "scripts/ship.sh",
        message,
        ...options,
        ...(bodyFile === null ? [] : ["--pr-body-file", bodyFile]),
        "--",
        ...files,
      ],
      { cwd: repository, env, encoding: "utf8", timeout: 10000 }
    );
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  }

  function expectUnshipped() {
    expect(git(["rev-parse", "HEAD"])).toBe(initialHead);
    expect(git(["ls-remote", "--heads", "origin", branch])).toBe("");
  }

  return {
    directory,
    origin,
    body,
    env,
    git,
    write,
    installGh,
    readLog,
    ghCalls,
    ship,
    expectUnshipped,
  };
}

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

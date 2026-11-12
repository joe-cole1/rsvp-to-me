import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { expect } from "vitest";

/**
 * A throwaway repository with a bare `origin`, the real `scripts/ship.sh` and its
 * `scripts/lib` helpers, and shims for preflight, npx and gh, for driving
 * ship.sh end to end without the network, Node tooling or GitHub.
 */

const REPO_ROOT = join(__dirname, "../..");
export const shipBranch = "codex/chore-baf40c62-ship-test";
export const shipMessage = "[baf40c62] chore(scripts): test PR handoff";
export const shipPrUrl = "https://github.com/example/fixture/pull/1";

const tools = Object.fromEntries(
  ["bash", "git", "grep", "cat", "cp", "mktemp", "rm", "sleep"].map((name) => [
    name,
    execFileSync("bash", ["-c", 'command -v "$1"', "ship-test", name], {
      encoding: "utf8",
    }).trim(),
  ])
);

export type GhMode = "forbidden" | "new" | "open";

export function createShipFixture() {
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
    NET_RETRY_DELAY: "0",
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
  mkdirSync(join(repository, "scripts/lib"), { recursive: true });
  const shipped = ["scripts/ship.sh", "scripts/lib/preflight-stamp.sh", "scripts/lib/net-retry.sh"];
  for (const path of shipped) copyFileSync(join(REPO_ROOT, path), join(repository, path));
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
  git(["add", "--", ...shipped, "scripts/preflight.sh", "reviewed.txt", "unreviewed.txt"]);
  git(["commit", "-m", "fixture baseline"]);
  git(["remote", "add", "origin", origin]);
  git(["push", "origin", "main"]);
  git(["switch", "-c", shipBranch]);
  const initialHead = git(["rev-parse", "HEAD"]);
  write("reviewed.txt", "after\n");

  /**
   * gh shim. `SHIP_TEST_GH_CREATE_FAILS` makes `gh pr create` fail first:
   * "network:<n>" fails n times with a DNS error, "fatal" always fails with a
   * non-network error.
   */
  function installGh(mode: GhMode) {
    env.SHIP_TEST_GH_MODE = mode;
    writeFileSync(
      join(bin, "gh"),
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const dir = process.env.SHIP_TEST_DIRECTORY;
fs.appendFileSync(path.join(dir, "gh-calls"), JSON.stringify(args) + "\\n");
const mode = process.env.SHIP_TEST_GH_MODE;
if (mode === "forbidden") process.exit(97);
if (args[0] !== "pr") process.exit(98);
switch (args[1]) {
  case "list":
    if (mode === "open") process.stdout.write(${JSON.stringify(shipPrUrl)} + "\\n");
    break;
  case "view":
    if (mode !== "open") process.exit(1);
    process.stdout.write(${JSON.stringify(shipPrUrl)} + "\\n");
    break;
  case "create": {
    const fails = process.env.SHIP_TEST_GH_CREATE_FAILS || "";
    if (fails === "fatal") {
      process.stderr.write("pull request create failed: GraphQL: Validation Failed\\n");
      process.exit(1);
    }
    const counter = path.join(dir, "create-attempts");
    const attempt = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0) + 1;
    fs.writeFileSync(counter, String(attempt));
    const networkFailures = Number((fails.match(/^network:(\\d+)$/) || [])[1] || 0);
    if (attempt <= networkFailures) {
      process.stderr.write("error connecting to api.github.com\\ndial tcp: lookup api.github.com: EAI_AGAIN\\n");
      process.exit(1);
    }
    process.stdout.write(${JSON.stringify(shipPrUrl)} + "\\n");
    break;
  }
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

  function bash(script: string, args: string[] = []) {
    const result = spawnSync(tools.bash, ["-c", script, "ship-test", ...args], {
      cwd: repository,
      env,
      encoding: "utf8",
      timeout: 10000,
    });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  /** The tree id preflight would record for the current working tree. */
  function treeId() {
    const result = bash(". scripts/lib/preflight-stamp.sh && preflight_tree_id");
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  }

  /** Record a preflight pass for the current working tree, as preflight.sh does. */
  function recordPass(mode: "full" | "fast") {
    const result = bash(
      '. scripts/lib/preflight-stamp.sh && preflight_record_pass "$1" "$(preflight_tree_id)"',
      [mode]
    );
    expect(result.status, result.stderr).toBe(0);
  }

  function ship({
    message = shipMessage,
    options = ["--pr-handoff"],
    files = ["reviewed.txt"],
    bodyFile = body,
  }: {
    message?: string;
    options?: string[];
    files?: string[] | null;
    bodyFile?: string | null;
  } = {}) {
    const result = spawnSync(
      tools.bash,
      [
        "scripts/ship.sh",
        message,
        ...options,
        ...(bodyFile === null ? [] : ["--pr-body-file", bodyFile]),
        ...(files === null ? [] : ["--", ...files]),
      ],
      { cwd: repository, env, encoding: "utf8", timeout: 20000 }
    );
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  }

  function expectUnshipped() {
    expect(git(["rev-parse", "HEAD"])).toBe(initialHead);
    expect(git(["ls-remote", "--heads", "origin", shipBranch])).toBe("");
  }

  return {
    directory,
    repository,
    origin,
    body,
    env,
    initialHead,
    git,
    write,
    installGh,
    readLog,
    ghCalls,
    bash,
    treeId,
    recordPass,
    ship,
    expectUnshipped,
  };
}

export type ShipFixture = ReturnType<typeof createShipFixture>;

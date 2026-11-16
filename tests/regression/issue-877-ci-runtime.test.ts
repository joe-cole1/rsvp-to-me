// #877 CI regression: sourcing nvm forced a switch into its empty version cache
// even when actions/setup-node had already selected the correct .nvmrc runtime.
// Under errexit this returned 3 before first-run browser validation could start.
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
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repository = resolve(__dirname, "../..");
const requiredNode = `v${readFileSync(join(repository, ".nvmrc"), "utf8").trim().replace(/^v/, "")}`;
const executables = Object.fromEntries(
  ["bash", "date", "mktemp", "rm", "ln"].map((name) => [
    name,
    execFileSync("bash", ["-c", 'command -v "$1"', "runtime-fixture", name], {
      encoding: "utf8",
    }).trim(),
  ])
);
let root: string;
let env: NodeJS.ProcessEnv;
let bin: string;
let nodeSource: string;
function write(file: string, contents: string) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, { mode: 0o755 });
}
function nodeVersion(version: string) {
  write("node-version", `${version}\n`);
}
function installNvm() {
  write(
    "nvm/nvm.sh",
    `
printf loaded > "$RUNTIME_FIXTURE_ROOT/nvm-loaded"
printf '%s\\n' "$@" > "$RUNTIME_FIXTURE_ROOT/nvm-load-args"
[ "\${1:-}" = --no-use ] || return 3
nvm() {
  printf '%s\\n' "$@" > "$RUNTIME_FIXTURE_ROOT/nvm-use-args"
  [ "\${RUNTIME_FIXTURE_FAIL_USE:-0}" != 1 ] || return 3
  printf '%s\\n' "$RUNTIME_FIXTURE_SELECTED" > "$RUNTIME_FIXTURE_ROOT/node-version"
  ln -sf "$RUNTIME_FIXTURE_NODE_SOURCE" "$RUNTIME_FIXTURE_BIN/node"
}
`
  );
}
function run() {
  const result = spawnSync(executables.bash, ["scripts/check-first-run-setup.sh"], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}
function expectReachedDatabase(result: ReturnType<typeof run>) {
  // The Node fixture stops at the first database operation, without executing it.
  expect(result.status, result.output).toBe(42);
  expect(existsSync(join(root, "database-reached"))).toBe(true);
}
beforeEach(() => {
  root = mkdtempSync("/tmp/rsvp-877-runtime-");
  bin = join(root, "bin");
  mkdirSync(bin);
  mkdirSync(join(root, "scripts/lib"), { recursive: true });
  for (const file of [
    ".nvmrc",
    "scripts/check-first-run-setup.sh",
    "scripts/lib/preflight-process-group.sh",
  ])
    copyFileSync(join(repository, file), join(root, file));
  for (const [name, executable] of Object.entries(executables))
    symlinkSync(executable, join(bin, name));
  write(
    "bin/git",
    '#!/bin/bash\n[[ "$*" = "rev-parse --show-toplevel" ]] || exit 90\nprintf "%s\\n" "$RUNTIME_FIXTURE_ROOT"\n'
  );
  nodeSource = join(root, "node-fixture");
  write(
    "node-fixture",
    `#!/bin/bash
if [ "\${1:-}" = --version ]; then
  IFS= read -r version < "$RUNTIME_FIXTURE_ROOT/node-version"
  printf '%s\\n' "$version"
else
  printf reached > "$RUNTIME_FIXTURE_ROOT/database-reached"
  exit 42
fi
`
  );
  symlinkSync(nodeSource, join(bin, "node"));
  nodeVersion(requiredNode);
  env = {
    NODE_ENV: "test",
    HOME: process.env.HOME,
    PATH: bin,
    NVM_DIR: join(root, "nvm"),
    DATABASE_URL: "postgresql://localhost/rsvp_test",
    RUNTIME_FIXTURE_ROOT: root,
    RUNTIME_FIXTURE_BIN: bin,
    RUNTIME_FIXTURE_NODE_SOURCE: nodeSource,
    RUNTIME_FIXTURE_SELECTED: requiredNode,
  };
});
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe("#877 first-run check runtime selection", () => {
  it("keeps the correct active Node without loading nvm or requiring a cached version", () => {
    installNvm();
    expectReachedDatabase(run());
    expect(existsSync(join(root, "nvm-loaded"))).toBe(false);
    expect(existsSync(join(root, "nvm-use-args"))).toBe(false);
  });
  it("accepts a correct active Node when nvm is absent", () => {
    expectReachedDatabase(run());
  });
  it.each(["different", "missing"])(
    "selects .nvmrc through nvm when active Node is %s",
    (state) => {
      if (state === "missing") rmSync(join(bin, "node"));
      else nodeVersion(`${requiredNode}-unselected`);
      installNvm();
      expectReachedDatabase(run());
      expect(readFileSync(join(root, "nvm-load-args"), "utf8").trim()).toBe("--no-use");
      expect(readFileSync(join(root, "nvm-use-args"), "utf8").trim().split("\n")).toEqual([
        "use",
        "--silent",
      ]);
      expect(readFileSync(join(root, "node-version"), "utf8").trim()).toBe(requiredNode);
    }
  );
  it.each(["different", "missing"])("rejects a %s runtime when no nvm fallback exists", (state) => {
    if (state === "missing") rmSync(join(bin, "node"));
    else nodeVersion(`${requiredNode}-unselected`);
    expect(run().status).toBe(1);
    expect(existsSync(join(root, "database-reached"))).toBe(false);
  });
  it("does not accept the wrong runtime even when nvm reports success", () => {
    nodeVersion(`${requiredNode}-unselected`);
    env.RUNTIME_FIXTURE_SELECTED = `${requiredNode}-still-unselected`;
    installNvm();
    expect(run().status).toBe(1);
    expect(existsSync(join(root, "database-reached"))).toBe(false);
  });
  it("reports failure to select the required nvm runtime before touching the database", () => {
    nodeVersion(`${requiredNode}-unselected`);
    env.RUNTIME_FIXTURE_FAIL_USE = "1";
    installNvm();
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain(".nvmrc");
    expect(existsSync(join(root, "database-reached"))).toBe(false);
  });
});

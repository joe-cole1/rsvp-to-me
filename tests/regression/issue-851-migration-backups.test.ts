// #851: startup dumps accumulated outside normal backup rotation and admin
// visibility. A shared pool would also let restarts erase secret-conversion
// recovery points. Failed/partial dumps must never trigger retention.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { systemConfig: { findUnique: vi.fn() } } }));
vi.mock("@/lib/auth-guards", () => ({ assertAdmin: vi.fn() }));
const root = process.cwd();
let fixture: string;
let directory: string;

function dump(purpose = "schema", fail = false) {
  return execFileSync(
    process.execPath,
    [
      "-e",
      `
    const { runPreMigrationBackup } = require(${JSON.stringify(path.join(root, "scripts/migrate-db.js"))});
    const result = runPreMigrationBackup("postgresql://user:fixture-password@localhost/test", process.argv[1]);
    console.log("RESULT=" + Boolean(result));
  `,
      purpose,
    ],
    {
      cwd: fixture,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fixture}/bin:${process.env.PATH}`, DUMP_FAIL: String(fail) },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}
function files() {
  return fs.readdirSync(directory).sort();
}
function legacy(index: number) {
  const filename = `pre-migration_2020-01-${String(index).padStart(2, "0")}T00-00-00-000Z.sql`;
  fs.writeFileSync(path.join(directory, filename), "legacy fixture", { mode: 0o600 });
  fs.utimesSync(path.join(directory, filename), index, index);
  return filename;
}

beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(tmpdir(), "rsvp-migration-retention-"));
  directory = path.join(fixture, "data/backups/pre-migration");
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(fixture, "bin"));
  fs.writeFileSync(
    path.join(fixture, "bin/pg_dump"),
    `#!/bin/bash
while [ "$#" -gt 0 ]; do
  if [ "$1" = -f ]; then shift; output=$1; fi
  shift
done
printf 'fixture dump' > "$output"
if [ "$DUMP_FAIL" = true ]; then
  echo 'fixture-password must not appear in logs' >&2
  exit 1
fi
`,
    { mode: 0o755 }
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  fs.rmSync(fixture, { recursive: true, force: true });
});

describe("#851 migration snapshot retention and visibility", () => {
  it("bounds startup churn separately from recovery snapshots and legacy dumps", () => {
    for (let index = 1; index <= 10; index++) legacy(index);
    dump("secrets");
    const recovery = files().filter((file) => !file.startsWith("pre-migration-schema_"));
    expect(recovery).toHaveLength(7);
    expect(recovery.some((file) => file.startsWith("pre-migration-secrets_"))).toBe(true);
    for (let index = 0; index < 10; index++) dump();
    expect(files().filter((file) => file.startsWith("pre-migration-schema_"))).toHaveLength(7);
    expect(files().filter((file) => !file.startsWith("pre-migration-schema_"))).toEqual(recovery);
    expect(files()).not.toContain("pre-migration_2020-01-01T00-00-00-000Z.sql");
  });

  it("keeps every recovery point when the replacement dump fails and removes partial data", () => {
    for (let index = 1; index <= 10; index++) legacy(index);
    const before = files();
    expect(dump("secrets", true)).toContain("RESULT=false");
    expect(files()).toEqual(before);
  });

  it("creates completed private dumps and ignores symlinks, directories and partial files", async () => {
    dump();
    const completed = files()[0];
    expect(fs.statSync(path.join(directory, completed)).mode & 0o777).toBe(0o600);
    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    expect(files().some((file) => file.endsWith(".partial"))).toBe(false);
    const legacyName = legacy(1);
    fs.unlinkSync(path.join(directory, legacyName));
    fs.symlinkSync(path.join(directory, completed), path.join(directory, legacyName));
    fs.mkdirSync(path.join(directory, legacyName.replace("01T", "02T")));
    fs.writeFileSync(path.join(directory, `${completed}.partial`), "incomplete");
    vi.spyOn(process, "cwd").mockReturnValue(fixture);
    const { listBackups } = await import("../../lib/backup");
    expect(await listBackups()).toEqual([
      expect.objectContaining({
        filename: `pre-migration/${completed}`,
        kind: "schema",
        sizeBytes: 12,
      }),
    ]);
  });

  it("rejects a symlinked snapshot directory before dumping or pruning", () => {
    const outside = path.join(fixture, "outside");
    fs.mkdirSync(outside);
    fs.rmSync(directory, { recursive: true });
    fs.symlinkSync(outside, directory);
    expect(dump()).toContain("RESULT=false");
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("shows legacy snapshots as recovery metadata and denies browser deletion/download", async () => {
    const name = legacy(1);
    vi.spyOn(process, "cwd").mockReturnValue(fixture);
    const { listBackups, deleteBackup } = await import("../../lib/backup");
    expect(await listBackups()).toEqual([
      expect.objectContaining({ filename: `pre-migration/${name}`, kind: "recovery" }),
    ]);
    expect(await deleteBackup(`pre-migration/${name}`)).toBe(false);
    const { GET } = await import("../../app/api/admin/backups/[filename]/route");
    const response = await GET(new Request("http://localhost/api/admin/backups/test"), {
      params: Promise.resolve({ filename: `pre-migration/${name}` }),
    });
    expect(response.status).toBe(404);
    expect(fs.existsSync(path.join(directory, name))).toBe(true);
  });
});

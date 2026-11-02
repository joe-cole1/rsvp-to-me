// September 2026 dependency backlog: npm audit stopped CI before application
// tests, and the override-cleanup proposal reintroduced unsupported transitive
// versions. Guard the installed dependency tree and exercise Prisma's real
// config loader with the patched deepmerge-ts dependency.
// October 2026: independent Next.js/ESLint updates broke the exact-patch guard.
// Keep a security floor while allowing coordinated future patches; also check
// the lockfile so a manifest-only update cannot leave the old toolchain installed.
// The consolidated October batch includes Next's 16.4.1 security fixes and
// Nodemailer's 10.1.2 hardening. Vitest 5.0.5 preserves Vite's default file-deny
// rules; its coverage provider requires the exact same runner patch.
// PR #775 (01a19bc3): exact worker pins rejected newer compatible patched
// lockfile versions. Enforce stable minimums and exercise both the original
// baseline and the PR's upgrades so the guard remains a real regression check.

// #779/#603 (01a19ceb): tsx exact pins rejected compatible security patches;
// upstream now supplies patched deepmerge-ts without overrides. Joi 18.3.1
// closes GHSA-4528-x5fx-h6hg in the development wait-on dependency tree.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromFile } from "@prisma/config";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
type Lock = { packages: Record<string, { version?: string; dev?: boolean }> };
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as Lock;
const workerLock = JSON.parse(
  readFileSync(join(ROOT, "worker", "package-lock.json"), "utf8")
) as Lock;
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
};

function atLeast(version: string, floor: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const actual = version.split(".").map(Number);
  const minimum = floor.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

function assertDependencyFloor(path: string, actual: string | undefined, minimum: string): void {
  expect(
    atLeast(actual ?? "", minimum),
    `${path}: expected stable version at least ${minimum}; received ${actual ?? "<missing>"}`
  ).toBe(true);
}

function assertRuntimeTsx(entry: Lock["packages"][string] | undefined): void {
  expect(
    atLeast(entry?.version ?? "", "4.23.15"),
    `tsx: expected stable runtime version at least 4.23.15; received ${entry?.version ?? "<missing>"}`
  ).toBe(true);
  expect(entry?.dev, "tsx: production database seeding requires a runtime dependency").not.toBe(
    true
  );
}

function assertNoDeepmergeOverride(overrides: Record<string, unknown> = {}): void {
  for (const [name, value] of Object.entries(overrides)) {
    expect(name, "deepmerge-ts must use native upstream dependencies").not.toMatch(
      /^deepmerge-ts(?:@|$)/
    );
    if (value && typeof value === "object") {
      assertNoDeepmergeOverride(value as Record<string, unknown>);
    }
  }
}

const workerDependencyFloors = [
  { name: "wrangler", minimum: "4.147.0", upgraded: "4.154.0", below: "4.146.0" },
  { name: "undici", minimum: "7.29.1", upgraded: "7.30.1", below: "7.29.0" },
  {
    name: "@cloudflare/workers-types",
    minimum: "5.20261003.1",
    upgraded: "5.20261028.1",
    below: "5.20261003.0",
  },
] as const;

type WorkerDependency = (typeof workerDependencyFloors)[number]["name"];

function assertWorkerDependencyFloor(
  dependency: WorkerDependency,
  actual: string | undefined
): void {
  const requirement = workerDependencyFloors.find(({ name }) => name === dependency);
  if (!requirement) throw new Error(`Unknown worker dependency: ${dependency}`);

  expect(
    atLeast(actual ?? "", requirement.minimum),
    `${dependency}: expected stable version at least ${requirement.minimum}; received ${actual ?? "<missing>"}`
  ).toBe(true);
}

const invalidWorkerVersions = workerDependencyFloors.flatMap(({ name, minimum }) => [
  { name, label: "missing", actual: undefined },
  { name, label: "malformed", actual: "not-a-version" },
  { name, label: "prerelease", actual: `${minimum}-rc.1` },
]);

describe("Dependency security baseline", () => {
  it.each([
    ["next", "16.4.1"],
    ["source-map-js", "1.2.2"],
    ["axios", "1.20.0"],
    ["brace-expansion", "5.0.12"],
    ["engine.io", "6.6.10"],
    ["undici", "8.10.2"],
    ["wait-on", "9.4.0"],
    ["deepmerge-ts", "8.0.0"],
    ["fast-uri", "3.1.7"],
    ["mysql2", "3.24.4"],
    ["nanoid", "3.3.18"],
    ["nodemailer", "10.1.2"],
    ["js-yaml", "4.3.2"],
    ["joi", "18.3.1"],
    ["vitest", "5.0.5"],
    ["@vitest/coverage-v8", "5.0.5"],
    ["@vitest/mocker", "5.0.5"],
  ])("keeps every %s resolution at or above %s", (name, minimum) => {
    const entries = Object.entries(lock.packages).filter(
      ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, entry] of entries) {
      assertDependencyFloor(path, entry.version, minimum);
    }
  });

  it("keeps the Cloudflare worker toolchain at the remediated dependency floor", () => {
    for (const { name } of workerDependencyFloors) {
      assertWorkerDependencyFloor(name, workerLock.packages[`node_modules/${name}`]?.version);
    }
  });

  it.each(workerDependencyFloors)(
    "accepts the original $name worker dependency baseline",
    ({ name, minimum }) => {
      expect(() => assertWorkerDependencyFloor(name, minimum)).not.toThrow();
    }
  );

  it.each(workerDependencyFloors)(
    "accepts the PR #775 upgraded $name worker dependency",
    ({ name, upgraded }) => {
      expect(() => assertWorkerDependencyFloor(name, upgraded)).not.toThrow();
    }
  );

  it.each(workerDependencyFloors)(
    "rejects the $name worker dependency below its security floor",
    ({ name, below }) => {
      expect(() => assertWorkerDependencyFloor(name, below)).toThrow();
    }
  );

  it.each(invalidWorkerVersions)(
    "rejects $label $name worker dependency versions",
    ({ name, actual }) => {
      expect(() => assertWorkerDependencyFloor(name, actual)).toThrow();
    }
  );

  it("reports the worker dependency and actual version when a floor fails", () => {
    expect(() => assertWorkerDependencyFloor("wrangler", "4.146.0")).toThrow(
      "wrangler: expected stable version at least 4.147.0; received 4.146.0"
    );
  });

  it("keeps Next.js and eslint-config-next on the same exact patch", () => {
    const nextVersion = manifest.dependencies?.next ?? "";
    expect(nextVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(atLeast(nextVersion, "16.4.1")).toBe(true);
    expect(manifest.devDependencies?.["eslint-config-next"]).toBe(nextVersion);

    for (const name of ["next", "eslint-config-next", "@next/env", "@next/eslint-plugin-next"]) {
      expect(lock.packages[`node_modules/${name}`]?.version, name).toBe(nextVersion);
    }

    const nativeCompilers = Object.entries(lock.packages).filter(([path]) =>
      path.startsWith("node_modules/@next/swc-")
    );
    expect(nativeCompilers.length).toBeGreaterThan(0);
    for (const [path, entry] of nativeCompilers) {
      expect(entry.version, path).toBe(nextVersion);
    }
  });

  it.each([
    ["React", ["react", "react-dom"]],
    ["Prisma", ["prisma", "@prisma/client", "@prisma/adapter-pg"]],
    ["Vitest", ["vitest", "@vitest/coverage-v8"]],
  ])("keeps the %s package group synchronized in the manifest and lockfile", (_, names) => {
    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    const version = lock.packages[`node_modules/${names[0]}`]?.version;
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const name of names) {
      expect(declared[name], name).toBe(declared[names[0]]);
      const resolutions = Object.entries(lock.packages).filter(
        ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
      );
      expect(resolutions.length, name).toBeGreaterThan(0);
      for (const [path, entry] of resolutions) expect(entry.version, path).toBe(version);
    }
  });

  it("uses Nodemailer's bundled declarations instead of the legacy DefinitelyTyped package", () => {
    expect(lock.packages["node_modules/@types/nodemailer"]).toBeUndefined();
  });

  it("keeps tsx in the runtime dependency tree for production database seeding", () => {
    assertRuntimeTsx(lock.packages["node_modules/tsx"]);
  });

  it.each(["4.23.15", "4.24.0"])("accepts stable runtime tsx %s", (version) => {
    expect(() => assertRuntimeTsx({ version })).not.toThrow();
  });

  it.each([
    { label: "below floor", entry: { version: "4.23.14" } },
    { label: "missing entry", entry: undefined },
    { label: "missing version", entry: {} },
    { label: "malformed", entry: { version: "not-a-version" } },
    { label: "prerelease", entry: { version: "4.24.0-rc.1" } },
    { label: "dev-only", entry: { version: "4.23.15", dev: true } },
  ])("rejects $label tsx runtime resolutions", ({ entry }) => {
    expect(() => assertRuntimeTsx(entry)).toThrow(/tsx:/);
  });

  it("rejects Joi below the GHSA-4528-x5fx-h6hg patched floor", () => {
    expect(() => assertDependencyFloor("node_modules/joi", "18.2.9", "18.3.1")).toThrow(
      "node_modules/joi: expected stable version at least 18.3.1; received 18.2.9"
    );
    expect(() => assertDependencyFloor("node_modules/joi", "18.3.1", "18.3.1")).not.toThrow();
  });

  it("uses native deepmerge-ts dependencies without global or scoped overrides", () => {
    assertNoDeepmergeOverride(manifest.overrides);
  });

  it.each([
    { "deepmerge-ts": "8.0.2" },
    { "@prisma/config": { "deepmerge-ts": "8.0.2" } },
    { "@prisma/config": { "deepmerge-ts@^8.0.0": "8.0.2" } },
  ])("rejects reintroduced deepmerge-ts overrides: %j", (overrides) => {
    expect(() => assertNoDeepmergeOverride(overrides)).toThrow();
  });

  it("excludes html-to-text 10.0.0 while allowing the unaffected 9.x renderer", () => {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path === "node_modules/html-to-text" || path.endsWith("/node_modules/html-to-text")) {
        expect(entry.version, path).not.toBe("10.0.0");
      }
    }
  });

  it("loads the actual Prisma config with its schema, migration path, and datasource", async () => {
    const result = await loadConfigFromFile({ configRoot: ROOT });
    expect(result.error).toBeUndefined();
    if (!result.config) throw new Error("Prisma config did not load");
    expect(result.config.schema).toBe(join(ROOT, "prisma/schema.prisma"));
    expect(result.config.migrations?.path).toBe(join(ROOT, "prisma/postgres-migrations"));
    expect(result.config.datasource?.url).toBe(process.env.DATABASE_URL);
  });
});

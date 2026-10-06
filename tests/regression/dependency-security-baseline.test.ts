// September 2026 dependency backlog: npm audit stopped CI before application
// tests, and the override-cleanup proposal reintroduced unsupported transitive
// versions. Guard the installed dependency tree and exercise Prisma's real
// config loader across the scoped deepmerge-ts security override.
// Vitest's redirect-mock file-read advisory requires the 4.1.11 patch family.
// October 2026: independent Next.js/ESLint updates broke the exact-patch guard.
// Keep a security floor while allowing coordinated future patches; also check
// the lockfile so a manifest-only update cannot leave the old toolchain installed.

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

describe("Dependency security baseline", () => {
  it.each([
    ["next", "16.3.8"],
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
    ["nodemailer", "10.0.12"],
    ["js-yaml", "4.3.2"],
    ["joi", "18.2.9"],
    ["vitest", "4.1.11"],
    ["@vitest/coverage-v8", "4.1.11"],
    ["@vitest/mocker", "4.1.11"],
  ])("keeps every %s resolution at or above %s", (name, minimum) => {
    const entries = Object.entries(lock.packages).filter(
      ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, entry] of entries) {
      expect(atLeast(entry.version ?? "", minimum), `${path}: ${entry.version}`).toBe(true);
    }
  });

  it("keeps the Cloudflare worker toolchain at the remediated dependency floor", () => {
    expect(workerLock.packages["node_modules/wrangler"]?.version).toBe("4.147.0");
    expect(workerLock.packages["node_modules/undici"]?.version).toBe("7.29.1");
    expect(workerLock.packages["node_modules/@cloudflare/workers-types"]?.version).toBe(
      "5.20261003.1"
    );
  });

  it("keeps Next.js and eslint-config-next on the same exact patch", () => {
    const nextVersion = manifest.dependencies?.next ?? "";
    expect(nextVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(atLeast(nextVersion, "16.3.8")).toBe(true);
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

  it("uses Nodemailer's bundled declarations instead of the legacy DefinitelyTyped package", () => {
    expect(lock.packages["node_modules/@types/nodemailer"]).toBeUndefined();
  });

  it("keeps tsx in the runtime dependency tree for production database seeding", () => {
    const tsx = lock.packages["node_modules/tsx"];
    expect(tsx?.version).toBe("4.23.15");
    expect(tsx?.dev).not.toBe(true);
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

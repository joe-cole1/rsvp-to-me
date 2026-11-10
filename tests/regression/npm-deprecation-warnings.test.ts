// Deprecated npm dependencies — clean installs emitted warnings for a redundant
// bcryptjs type stub and scmp, which the Twilio SDK pulled in transitively.
//
// Root cause (found 2026-07): bcryptjs already shipped its own declarations,
// while the application used the Twilio SDK only for one Messages REST call.
//
// Fix: rely on bcryptjs's bundled types and call the Twilio Messages endpoint
// directly with the platform fetch API, removing both deprecated packages.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string; deprecated?: string }>;
};

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, filename), "utf8")) as T;
}

function knownWarnings(packages: NonNullable<PackageLock["packages"]>) {
  const knownPackages = ["@types/bcryptjs", "scmp", "twilio"];
  return Object.entries(packages)
    .filter(
      ([path, entry]) =>
        entry.deprecated &&
        knownPackages.some(
          (name) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
        )
    )
    .map(([path]) => path);
}

describe("deprecated npm dependency cleanup", () => {
  it("does not declare the redundant type stub or Twilio SDK", () => {
    const manifest = readJson<PackageManifest>("package.json");

    expect(manifest.devDependencies).not.toHaveProperty("@types/bcryptjs");
    expect(manifest.dependencies).not.toHaveProperty("twilio");
  });

  it("does not reintroduce the known deprecation warnings through transitive dependencies", () => {
    const lock = readJson<PackageLock>("package-lock.json");
    expect(knownWarnings(lock.packages ?? {})).toEqual([]);
  });

  it("allows a maintained transitive release of a formerly deprecated package", () => {
    expect(knownWarnings({ "node_modules/tool/node_modules/scmp": { version: "4.0.0" } })).toEqual(
      []
    );
  });

  it("still detects a known deprecated release nested under an upgraded tool", () => {
    const path = "node_modules/tool/node_modules/scmp";
    expect(
      knownWarnings({ [path]: { version: "2.1.0", deprecated: "use a maintained implementation" } })
    ).toEqual([path]);
  });
});

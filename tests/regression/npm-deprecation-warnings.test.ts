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
  packages?: Record<string, unknown>;
};

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, filename), "utf8")) as T;
}

describe("deprecated npm dependency cleanup", () => {
  it("does not declare the redundant type stub or Twilio SDK", () => {
    const manifest = readJson<PackageManifest>("package.json");

    expect(manifest.devDependencies).not.toHaveProperty("@types/bcryptjs");
    expect(manifest.dependencies).not.toHaveProperty("twilio");
  });

  it("does not resolve deprecated warning packages in package-lock.json", () => {
    const lock = readJson<PackageLock>("package-lock.json");
    const forbiddenPackages = ["@types/bcryptjs", "scmp", "twilio"];
    const resolutions = Object.keys(lock.packages ?? {}).filter((path) =>
      forbiddenPackages.some(
        (packageName) =>
          path === `node_modules/${packageName}` || path.endsWith(`/node_modules/${packageName}`)
      )
    );

    expect(resolutions).toEqual([]);
  });
});

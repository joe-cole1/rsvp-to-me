// GHSA-g7r4-m6w7-qqqr — esbuild's development server allowed arbitrary file
// reads on Windows through backslash-based path traversal.
//
// Bug (found 2026-07, dependency security review): @react-email/ui pinned
// esbuild 0.28.0, whose POSIX-only request-path cleanup did not treat Windows
// backslashes as separators. A crafted servedir request could therefore escape
// the configured root. The fix globally overrides esbuild to patched version
// 0.28.1 and guards both the manifest constraint and every lockfile resolution.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

type PackageManifest = {
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, filename), "utf8")) as T;
}

function isVulnerable(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return true;

  const [, major, minor, patch] = match.map(Number);
  return major === 0 && (minor === 27 ? patch >= 3 : minor === 28 && patch < 1);
}

describe("GHSA-g7r4-m6w7-qqqr: patched esbuild dependency", () => {
  it("keeps a patched global override in package.json", () => {
    const manifest = readJson<PackageManifest>("package.json");

    expect(manifest.overrides?.esbuild).toBe("0.28.1");
  });

  it("contains no vulnerable esbuild resolution in package-lock.json", () => {
    const lock = readJson<PackageLock>("package-lock.json");
    const resolutions = Object.entries(lock.packages ?? {}).filter(
      ([path]) => path === "node_modules/esbuild" || path.endsWith("/node_modules/esbuild")
    );

    expect(resolutions.length).toBeGreaterThan(0);
    for (const [path, entry] of resolutions) {
      expect(entry.version, `${path} must have a version`).toBeDefined();
      expect(
        isVulnerable(entry.version!),
        `${path} resolves vulnerable esbuild ${entry.version}`
      ).toBe(false);
    }
  });
});

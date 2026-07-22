// GHSA-f88m-g3jw-g9cj — Sharp versions before 0.35.0 inherited four
// high-severity vulnerabilities from their bundled libvips build.
//
// Root cause (found 2026-07): Next.js, React Email UI, and Miniflare still
// constrained Sharp to 0.34.x after Sharp published the patched 0.35 release.
// The application deliberately overrides that unsupported range and exercises
// the exact transform operations used by Next's image optimizer.

import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

type PackageManifest = {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, filename), "utf8")) as T;
}

function isPatched(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;

  const [, major, minor] = match.map(Number);
  return major > 0 || minor >= 35;
}

describe("GHSA-f88m-g3jw-g9cj: patched Sharp/libvips", () => {
  it("pins one explicit production version and overrides transitive constraints", () => {
    const manifest = readJson<PackageManifest>("package.json");
    const workerManifest = readJson<PackageManifest>("worker/package.json");

    expect(manifest.dependencies?.sharp).toBe("0.35.3");
    expect(manifest.overrides?.sharp).toBe("$sharp");
    expect(workerManifest.overrides?.sharp).toBe("0.35.3");
  });

  it.each(["package-lock.json", "worker/package-lock.json"])(
    "contains no vulnerable Sharp resolution in %s",
    (filename) => {
      const lock = readJson<PackageLock>(filename);
      const resolutions = Object.entries(lock.packages ?? {}).filter(
        ([path]) => path === "node_modules/sharp" || path.endsWith("/node_modules/sharp")
      );

      expect(resolutions.length).toBeGreaterThan(0);
      for (const [path, entry] of resolutions) {
        expect(entry.version, `${path} must have a version`).toBeDefined();
        expect(
          isPatched(entry.version!),
          `${path} resolves vulnerable Sharp ${entry.version}`
        ).toBe(true);
      }
    }
  );

  it("supports the transform pipeline used by the Next.js image optimizer", async () => {
    expect(sharp.versions.sharp).toBe("0.35.3");

    const source = await sharp({
      create: {
        width: 96,
        height: 72,
        channels: 4,
        background: { r: 124, g: 58, b: 237, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    for (const format of ["jpeg", "png", "webp", "avif"] as const) {
      const transformer = sharp(source, {
        limitInputPixels: 268_402_689,
        sequentialRead: true,
      })
        .timeout({ seconds: 7 })
        .rotate()
        .resize(64, undefined, { withoutEnlargement: true });

      const output = await transformer[format]({ quality: 75 }).toBuffer();
      const metadata = await sharp(output).metadata();

      expect(output.byteLength).toBeGreaterThan(0);
      expect(metadata.width).toBe(64);
      expect(metadata.height).toBe(48);
    }
  });
});

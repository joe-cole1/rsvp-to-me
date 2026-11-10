// GHSA-f88m-g3jw-g9cj — Sharp versions before 0.35.0 inherited four
// high-severity vulnerabilities from their bundled libvips build.
//
// Root cause (found 2026-07): Next.js, React Email UI, and Miniflare still
// constrained Sharp to 0.34.x after Sharp published the patched 0.35 release.
// The application deliberately overrides that unsupported range and exercises
// the exact transform operations used by Next's image optimizer.
// GHSA-rgj7-g3m4-5g8c (2026-09): the libheif fix raises the minimum to
// 0.35.4. Keep both projects patched; their independent toolchains can select
// different safe releases without changing the application contract.

import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { assertResolvedFloor, type LockedPackages } from "@/tests/helpers/dependency-versions";

const REPO_ROOT = join(__dirname, "..", "..");

type PackageLock = {
  packages: LockedPackages;
};

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, filename), "utf8")) as T;
}

describe("GHSA-f88m-g3jw-g9cj: patched Sharp/libvips", () => {
  it.each(["package-lock.json", "worker/package-lock.json"])(
    "contains no vulnerable Sharp resolution in %s",
    (filename) => {
      const lock = readJson<PackageLock>(filename);
      // The worker is an independent toolchain: its safe native version need
      // not equal the app's. Sharp remains required for app image transforms.
      assertResolvedFloor(lock.packages, "sharp", "0.35.4", filename === "package-lock.json");
    }
  );

  it("supports the transform pipeline used by the Next.js image optimizer", async () => {
    const lock = readJson<PackageLock>("package-lock.json");
    expect(sharp.versions.sharp).toBe(lock.packages["node_modules/sharp"]?.version);

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

// #902 GHSA-g3hv-75wg-m249 (minimatch globparts amplification, 7.0.0–11.0.0)
// and #915 GHSA-7589-6fvf-x4pw (effect Schema.TemplateLiteral ReDoS, <= 3.22.0).
//
// Root cause (found 2026-11): the lockfile kept typescript-eslint 8.66.0, whose
// typescript-estree nested minimatch 10.2.6, although eslint-config-next's
// `^8.56.0` range already allowed the fixed 8.73.0. Prisma 7.10.1, the newest
// stable release, pins effect 3.20.0 through @prisma/config, which loads every
// time migrations run. An override nested under `prisma` did not reach that
// grandchild, so the fix scopes the override to @prisma/config itself.
//
// Guard every present resolution (allowing upstream to drop either package),
// cover patched-newer and known-bad fixtures, and check the copy Prisma's
// config loader actually resolves.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertResolvedFloor,
  assertResolvedOutsideRange,
  atLeast,
  outsideAffectedRange,
  type LockedPackages,
} from "@/tests/helpers/dependency-versions";

const ROOT = join(__dirname, "..", "..");
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as {
  packages: LockedPackages;
};

const MINIMATCH = ["minimatch", "7.0.0", "11.0.1"] as const;
const EFFECT = ["effect", "3.22.1"] as const;

describe("#902 minimatch GHSA-g3hv-75wg-m249", () => {
  it("keeps every installed minimatch resolution outside the affected range", () => {
    assertResolvedOutsideRange(lock.packages, ...MINIMATCH);
  });

  it.each(["3.1.5", "6.2.0", "11.0.1", "11.0.9", "12.0.0"])("accepts unaffected %s", (v) => {
    expect(outsideAffectedRange(v, MINIMATCH[1], MINIMATCH[2])).toBe(true);
  });

  it.each(["7.0.0", "9.0.5", "10.2.6", "11.0.0", "11.0.1-rc.1", "not-a-version", ""])(
    "rejects affected or unreviewable %j",
    (v) => {
      expect(outsideAffectedRange(v, MINIMATCH[1], MINIMATCH[2])).toBe(false);
    }
  );

  it("checks nested copies and allows upstream to remove the package", () => {
    const nested = {
      "node_modules/minimatch": { version: "11.0.9" },
      "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch": {
        version: "10.2.6",
      },
    };
    expect(() => assertResolvedOutsideRange(nested, ...MINIMATCH)).toThrow(/typescript-estree/);
    expect(() => assertResolvedOutsideRange({}, ...MINIMATCH)).not.toThrow();
  });
});

describe("#915 effect GHSA-7589-6fvf-x4pw", () => {
  it("keeps every installed effect resolution at or above 3.22.1", () => {
    assertResolvedFloor(lock.packages, ...EFFECT);
  });

  it("loads a patched effect from Prisma's config package", () => {
    const configRequire = createRequire(require.resolve("@prisma/config"));
    const manifest = JSON.parse(
      readFileSync(configRequire.resolve("effect/package.json"), "utf8")
    ) as { name?: string; version?: string };
    expect(manifest.name).toBe("effect");
    expect(atLeast(manifest.version ?? "", EFFECT[1]), manifest.version).toBe(true);
  });

  it("accepts patched and newer majors and rejects vulnerable fixtures", () => {
    for (const version of ["3.22.1", "3.22.5", "4.1.5"]) {
      expect(() =>
        assertResolvedFloor({ "node_modules/effect": { version } }, ...EFFECT)
      ).not.toThrow();
    }
    for (const version of ["3.20.0", "3.22.0", "3.22.1-beta.1"]) {
      expect(() =>
        assertResolvedFloor({ "node_modules/effect": { version } }, ...EFFECT)
      ).toThrow();
    }
    expect(() => assertResolvedFloor({}, ...EFFECT)).not.toThrow();
  });
});

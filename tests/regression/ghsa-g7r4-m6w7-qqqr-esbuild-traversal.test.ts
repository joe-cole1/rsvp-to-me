// GHSA-g7r4-m6w7-qqqr: esbuild 0.28.1 fixed Windows path traversal.
// November 2026 (d4ae35f3): the old guard required exactly that override,
// rejecting later fixes and upstream removing the dependency altogether.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertResolvedFloor, type LockedPackages } from "@/tests/helpers/dependency-versions";

describe("GHSA-g7r4-m6w7-qqqr: patched esbuild dependency", () => {
  it.each(["package-lock.json", "worker/package-lock.json"])(
    "rejects vulnerable esbuild resolutions in %s",
    (filename) => {
      const lock = JSON.parse(readFileSync(join(__dirname, "../..", filename), "utf8")) as {
        packages: LockedPackages;
      };
      assertResolvedFloor(lock.packages, "esbuild", "0.28.1");
    }
  );

  it.each(["0.28.1", "0.28.2", "0.29.0", "1.0.0"])("accepts patched esbuild %s", (version) => {
    expect(() =>
      assertResolvedFloor({ "node_modules/esbuild": { version } }, "esbuild", "0.28.1")
    ).not.toThrow();
  });

  it.each(["0.27.3", "0.28.0", "0.29.0-rc.1", "invalid"])(
    "rejects unsupported esbuild %s",
    (version) => {
      expect(() =>
        assertResolvedFloor(
          { "node_modules/tool/node_modules/esbuild": { version } },
          "esbuild",
          "0.28.1"
        )
      ).toThrow();
    }
  );

  it("allows upstream to remove esbuild and its override", () => {
    expect(() => assertResolvedFloor({}, "esbuild", "0.28.1")).not.toThrow();
  });
});

// @vitest-environment jsdom
// November 2026, #831/#832: test infrastructure treated selected package
// versions and CSS serialization as application contracts. Future patched
// versions and removed transitive packages must pass, while unsafe trees fail.
import { describe, expect, it } from "vitest";
import { assertResolvedFloor, atLeast } from "@/tests/helpers/dependency-versions";
import { aspectRatio, cssValue } from "@/tests/helpers/css";

describe("dependency upgrades preserve security contracts", () => {
  it.each(["1.2.3", "1.2.4", "1.3.0", "2.0.0", "2.0.0+build.1"])(
    "accepts supported stable version %s",
    (version) => {
      expect(atLeast(version, "1.2.3")).toBe(true);
    }
  );

  it.each(["1.2.2", "0.99.0", "2.0.0-rc.1", "1.2", "01.2.3", "not-a-version", ""])(
    "rejects unsupported version %s",
    (version) => {
      expect(atLeast(version, "1.2.3")).toBe(false);
    }
  );

  it("allows a transitive package to disappear after an upstream remediation", () => {
    expect(() => assertResolvedFloor({}, "transitive", "1.2.3")).not.toThrow();
  });

  it("still rejects a missing required direct dependency", () => {
    expect(() => assertResolvedFloor({}, "required", "1.2.3", true)).toThrow("required");
  });

  it("checks every nested resolution, even when the root is patched", () => {
    expect(() =>
      assertResolvedFloor(
        {
          "node_modules/library": { version: "2.0.0" },
          "node_modules/tool/node_modules/library": { version: "1.2.2" },
        },
        "library",
        "1.2.3"
      )
    ).toThrow("node_modules/tool/node_modules/library");
  });

  it("rejects a missing version on a present transitive package", () => {
    expect(() => assertResolvedFloor({ "node_modules/library": {} }, "library", "1.2.3")).toThrow(
      "<missing>"
    );
  });

  it("allows independent toolchains to select different safe versions", () => {
    for (const version of ["1.2.3", "2.0.0"]) {
      expect(() =>
        assertResolvedFloor({ "node_modules/library": { version } }, "library", "1.2.3", true)
      ).not.toThrow();
    }
  });
});

describe("CSS aspect ratio assertions", () => {
  it.each(["1.7777777777777777", "1.77778 / 1", "16 / 9", "1600/900"])(
    "accepts equivalent 16:9 serialization %s",
    (value) => {
      expect(aspectRatio(value)).toBeCloseTo(16 / 9, 4);
    }
  );

  it("preserves the denominator, so different proportions still fail", () => {
    expect(aspectRatio("16 / 10")).not.toBeCloseTo(16 / 9, 4);
  });

  it.each(["", "auto", "0 / 1", "1 / 0", "-1", "NaN", "Infinity", "1 / 2 / 3"])(
    "rejects a missing or invalid ratio %s",
    (value) => {
      expect(() => aspectRatio(value)).toThrow();
    }
  );
});

describe("responsive CSS declaration assertions", () => {
  it("normalizes formatting without comparing responsive rules to computed pixels", () => {
    const editor = document.createElement("textarea");
    editor.style.maxHeight = "min(60dvh,480px)";
    expect(editor.style.maxHeight).toBe(cssValue("max-height", "min(60dvh, 480px)", document));
    expect(editor.style.maxHeight).not.toBe(cssValue("max-height", "min(80dvh, 480px)", document));
  });

  it("still rejects a missing declaration", () => {
    const editor = document.createElement("textarea");
    expect(editor.style.maxHeight).not.toBe(cssValue("max-height", "min(60dvh, 480px)", document));
  });

  it("rejects an invalid expected CSS value instead of accepting two empty strings", () => {
    expect(() => cssValue("max-height", "invalid", document)).toThrow();
  });
});

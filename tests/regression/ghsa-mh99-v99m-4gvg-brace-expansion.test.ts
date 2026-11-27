// GHSA-mh99-v99m-4gvg — brace-expansion could exhaust process memory.
//
// Root cause (found 2026-07): ESLint plugins bundled by eslint-config-next
// resolve minimatch 3, which requires brace-expansion's legacy callable CommonJS
// API, whereas modern minimatch consumes the named `expand` export. Before
// upstream backported fixes to brace-expansion 1.x (>= 1.1.21), a temporary
// vendored adapter bridged both interfaces.
//
// Resolution (#546): upstream now publishes patched brace-expansion 1.x
// releases alongside 5.x (>= 5.0.12), so both ESLint's minimatch 11 and
// eslint-config-next's minimatch 3 resolve natively with no shim or override.

import { createRequire } from "node:module";
import { sep } from "node:path";
import { describe, expect, it } from "vitest";

type Expand = (pattern: string) => string[];
type Minimatch = {
  (path: string, pattern: string): boolean;
  braceExpand: Expand;
};
type MinimatchModule = Minimatch | { minimatch: Minimatch; braceExpand: Expand };
type BraceExpansionModule = Expand | { expand: Expand };

function extractMinimatch(mod: MinimatchModule): { match: Minimatch; braceExpand: Expand } {
  const match = typeof mod === "function" ? mod : mod.minimatch;
  return { match, braceExpand: mod.braceExpand };
}

function extractExpand(mod: BraceExpansionModule): Expand {
  return typeof mod === "function" ? mod : mod.expand;
}

const rootRequire = createRequire(import.meta.url);
const eslintRequire = createRequire(rootRequire.resolve("eslint/package.json"));
const nextConfigRequire = createRequire(rootRequire.resolve("eslint-config-next"));

const eslintMinimatch = extractMinimatch(eslintRequire("minimatch") as MinimatchModule);
const nextMinimatchPath = nextConfigRequire.resolve("minimatch");
const nextMinimatch = extractMinimatch(nextConfigRequire(nextMinimatchPath) as MinimatchModule);
const nextMinimatchRequire = createRequire(nextMinimatchPath);
const nextBraceExpansionPath = nextMinimatchRequire.resolve("brace-expansion");
const nextBraceExpansion = extractExpand(
  nextMinimatchRequire(nextBraceExpansionPath) as BraceExpansionModule
);
const modernMinimatch = extractMinimatch(rootRequire("minimatch") as MinimatchModule);
const modernBraceExpansion = extractExpand(rootRequire("brace-expansion") as BraceExpansionModule);

describe("GHSA-mh99-v99m-4gvg brace-expansion compatibility", () => {
  it("preserves legacy and modern minimatch brace matching without overrides", () => {
    const pattern = "file{1..3}.js";
    const expected = ["file1.js", "file2.js", "file3.js"];

    expect(eslintMinimatch.braceExpand(pattern)).toEqual(expected);
    expect(eslintMinimatch.match("file2.js", pattern)).toBe(true);

    expect(nextMinimatch.braceExpand(pattern)).toEqual(expected);
    expect(nextMinimatch.match("file2.js", pattern)).toBe(true);

    expect(modernMinimatch.braceExpand(pattern)).toEqual(expected);
    expect(modernMinimatch.match("file2.js", pattern)).toBe(true);
  });

  it("resolves native upstream brace-expansion outside vendor/ for both consumers", () => {
    const pattern = "file{alpha,beta}.js";
    const expected = ["filealpha.js", "filebeta.js"];

    expect(nextBraceExpansionPath).not.toContain(`${sep}vendor${sep}`);
    expect(nextBraceExpansion(pattern)).toEqual(expected);
    expect(modernBraceExpansion(pattern)).toEqual(expected);
  });
});

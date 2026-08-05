// GHSA-mh99-v99m-4gvg — brace-expansion could exhaust process memory.
//
// Root cause (found 2026-07): ESLint 9 and eslint-config-next still resolve
// minimatch 3, which requires brace-expansion's legacy callable CommonJS API.
// The only patched brace-expansion release uses a named `expand` export, while
// modern minimatch consumes that named API. A blind override therefore made
// npm audit pass but broke lint-time brace expansion.
//
// Fix: a temporary dual-API adapter delegates both interfaces to the official
// patched implementation. Issue #546 tracks removing it after upstream fixes.

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import minimatchDefault, { minimatch as modernMinimatch } from "minimatch";

type Expand = (pattern: string) => string[];
type LegacyMinimatch = {
  (path: string, pattern: string): boolean;
  braceExpand: Expand;
};
type ExpansionAdapter = Expand & {
  expand: Expand;
};

const rootRequire = createRequire(import.meta.url);
const eslintRequire = createRequire(rootRequire.resolve("eslint/package.json"));
const legacyMinimatch = eslintRequire("minimatch") as LegacyMinimatch;
const adapter = rootRequire("brace-expansion") as ExpansionAdapter;
const patched = rootRequire("brace-expansion-patched") as { expand: Expand };
const modernMinimatchFn = modernMinimatch || (minimatchDefault as unknown as typeof modernMinimatch);

describe("GHSA-mh99-v99m-4gvg brace-expansion compatibility", () => {
  it("preserves legacy and modern minimatch brace matching", () => {
    const pattern = "file{1..3}.js";
    const expected = ["file1.js", "file2.js", "file3.js"];

    expect(typeof legacyMinimatch).toBe("function");
    expect(legacyMinimatch.braceExpand(pattern)).toEqual(expected);
    expect(legacyMinimatch("file2.js", pattern)).toBe(true);
    expect(modernMinimatchFn("file2.js", pattern)).toBe(true);
  });

  it("delegates callable and named exports to the patched implementation", () => {
    const pattern = "file{alpha,beta}.js";

    expect(adapter.expand).toBe(adapter);
    expect(adapter(pattern)).toEqual(patched.expand(pattern));
    expect(adapter.expand(pattern)).toEqual(["filealpha.js", "filebeta.js"]);
  });
});

// November 2026, d4ae35f3: a font-build fixture created generated route types
// under .vitest while lint ran, producing unrelated failures. Agent worktrees
// can do the same. Verify effective lint/type discovery, not only config text.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

describe.each([".vitest", ".claude/worktrees"])("generated workspace %s", (directory) => {
  it("is excluded from lint and app type checking while app sources remain checked", async () => {
    const parent = join(ROOT, directory);
    mkdirSync(parent, { recursive: true });
    const fixture = mkdtempSync(join(parent, "discovery-"));
    try {
      const file = join(fixture, "generated.test.ts");
      writeFileSync(file, "export {};\n");
      const appSource = join(ROOT, "lib/utils.ts");
      const eslint = new ESLint({ cwd: ROOT });
      expect(await eslint.isPathIgnored(file)).toBe(true);
      expect(await eslint.isPathIgnored(appSource)).toBe(false);

      const config = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile);
      expect(config.error).toBeUndefined();
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
      expect(parsed.errors).toEqual([]);
      expect(parsed.fileNames).not.toContain(file);
      expect(parsed.fileNames).toContain(appSource);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});

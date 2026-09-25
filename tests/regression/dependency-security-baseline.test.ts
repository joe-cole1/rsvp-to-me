// September 2026 dependency backlog: npm audit stopped CI before application
// tests, and the override-cleanup proposal reintroduced unsupported transitive
// versions. Guard the installed dependency tree and exercise Prisma's real
// config loader across the scoped deepmerge-ts security override.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromFile } from "@prisma/config";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
type Lock = { packages: Record<string, { version?: string }> };
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as Lock;

function atLeast(version: string, floor: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const actual = version.split(".").map(Number);
  const minimum = floor.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

describe("September dependency security baseline", () => {
  it.each([
    ["next", "16.3.6"],
    ["deepmerge-ts", "8.0.0"],
    ["fast-uri", "3.1.7"],
    ["mysql2", "3.24.4"],
    ["nanoid", "3.3.18"],
    ["nodemailer", "9.1.1"],
    ["js-yaml", "4.3.2"],
    ["joi", "18.2.9"],
  ])("keeps every %s resolution at or above %s", (name, minimum) => {
    const entries = Object.entries(lock.packages).filter(
      ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, entry] of entries) {
      expect(atLeast(entry.version ?? "", minimum), `${path}: ${entry.version}`).toBe(true);
    }
  });

  it("excludes html-to-text 10.0.0 while allowing the unaffected 9.x renderer", () => {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path === "node_modules/html-to-text" || path.endsWith("/node_modules/html-to-text")) {
        expect(entry.version, path).not.toBe("10.0.0");
      }
    }
  });

  it("loads the actual Prisma config with its schema, migration path, and datasource", async () => {
    const result = await loadConfigFromFile({ configRoot: ROOT });
    expect(result.error).toBeUndefined();
    if (!result.config) throw new Error("Prisma config did not load");
    expect(result.config.schema).toBe(join(ROOT, "prisma/schema.prisma"));
    expect(result.config.migrations?.path).toBe(join(ROOT, "prisma/postgres-migrations"));
    expect(result.config.datasource?.url).toBe(process.env.DATABASE_URL);
  });
});

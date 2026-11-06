// Root cause (2026-11-05, design review B-2, #806, task 4f84f787): the host bar built
// its active-tab tint as `rgba(${t.accent},0.2)`. `accent` is a hex color, so the
// browser received `rgba(#f43f5e,0.2)`, which is invalid CSS, and dropped it. The
// branch was also unreachable: the floating bar renders only while no panel is open,
// so no tab is ever active on it. The fix removes the dead active style. This guard
// keeps any source file from building a tint out of a hex color again; tints come
// from `accentRgb` (or another `…Rgb` triple) or from `accentBg`.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib", "emails"];
const SKIP = new Set(["node_modules", "generated", ".next"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** An interpolation is safe when it is an r,g,b triple or parses the hex itself. */
function isRgbTriple(expression: string): boolean {
  const e = expression.trim();
  return /rgb$/i.test(e) || e.startsWith("parseInt(");
}

describe("color tints (#806)", () => {
  it("never interpolates a hex color into rgb() or rgba()", () => {
    const offenders: string[] = [];
    for (const dir of SOURCE_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, index) => {
            for (const match of line.matchAll(/rgba?\(\s*\$\{([^}]*)\}/g)) {
              if (!isRgbTriple(match[1])) {
                offenders.push(`${relative(ROOT, file)}:${index + 1} ${match[0]}`);
              }
            }
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Docker vendored dependency context — production image builds failed at
// `npm ci` with repeated "Missing: brace-expansion@ from lock file" errors.
//
// Root cause (found 2026-07): a temporary file-based override and install-links
// npm setting were added without copying those inputs into the Docker
// dependency stages before `npm ci`. Even after #546 removed that shim, keep
// verifying that every local `file:` dependency or `.npmrc` needed by
// `package.json` is copied into both Docker install stages and that stale
// references to deleted files cannot linger in `Dockerfile`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
};

function collectFileDeps(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.startsWith("file:")) {
      out.push(value.slice("file:".length).replace(/^\.\//, ""));
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      collectFileDeps(child, out);
    }
  }
  return out;
}

function extractStage(name: string): string {
  const match = dockerfile.match(
    new RegExp(`FROM\\s+\\$\\{NODE_IMAGE\\}\\s+AS\\s+${name}[\\s\\S]*?(?=\\nFROM\\s+|$)`)
  );
  if (!match) throw new Error(`Missing Dockerfile stage: ${name}`);
  return match[0];
}

function extractCopySourcesBeforeNpmCi(stage: string): string[] {
  const npmCiIndex = stage.indexOf("RUN npm");
  expect(npmCiIndex).toBeGreaterThan(-1);
  const preamble = stage.slice(0, npmCiIndex);
  const sources: string[] = [];
  for (const line of preamble.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("COPY ")) continue;
    const tokens = trimmed.slice("COPY ".length).trim().split(/\s+/);
    // Drop destination (last token) and any flags like --from=...
    for (const token of tokens.slice(0, -1)) {
      if (!token.startsWith("--")) sources.push(token.replace(/^\.\//, ""));
    }
  }
  return sources;
}

describe("Docker vendored dependency context", () => {
  it("copies every local npm install input before npm ci and keeps no stale vendor COPY lines", () => {
    const fileDeps = [
      ...collectFileDeps(manifest.dependencies),
      ...collectFileDeps(manifest.devDependencies),
      ...collectFileDeps(manifest.overrides),
    ];

    for (const stageName of ["deps", "prod-deps"]) {
      const stage = extractStage(stageName);
      const sources = extractCopySourcesBeforeNpmCi(stage);

      expect(stage).toContain("npm ci");
      expect(sources).toContain("package*.json");

      for (const localDep of fileDeps) {
        expect(sources).toContain(localDep);
      }

      if (fileDeps.length > 0 && existsSync(join(REPO_ROOT, ".npmrc"))) {
        expect(sources).toContain(".npmrc");
      } else {
        expect(sources).not.toContain(".npmrc");
        expect(sources).not.toContain("vendor/brace-expansion-compat");
      }

      for (const source of sources) {
        if (!source.includes("*")) {
          expect(existsSync(join(REPO_ROOT, source)), `${stageName}: missing ${source}`).toBe(true);
        }
      }
    }
  });
});

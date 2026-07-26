// Docker vendored dependency context — production image builds failed at
// `npm ci` with repeated "Missing: brace-expansion@ from lock file" errors.
//
// Root cause (found 2026-07): the audited dependency remediation introduced a
// file-based override and install-links npm setting, but the Docker dependency
// stage copied only package*.json before installing. The lockfile therefore
// referenced a local package that did not exist inside the build stage.
//
// Fix: copy .npmrc and the exact vendored package before running npm ci.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
const depsStage = dockerfile.split(/FROM\s+\$\{NODE_IMAGE\}\s+AS\s+builder/)[0] ?? "";

describe("Docker vendored dependency context", () => {
  it("copies every local npm install input before npm ci", () => {
    const npmConfigCopy = depsStage.indexOf("COPY package*.json .npmrc ./");
    const vendorCopy = depsStage.indexOf(
      "COPY vendor/brace-expansion-compat ./vendor/brace-expansion-compat"
    );
    const npmCi = depsStage.indexOf("RUN npm ci");

    expect(npmConfigCopy).toBeGreaterThan(-1);
    expect(vendorCopy).toBeGreaterThan(-1);
    expect(npmCi).toBeGreaterThan(-1);
    expect(npmConfigCopy).toBeLessThan(npmCi);
    expect(vendorCopy).toBeLessThan(npmCi);
  });
});

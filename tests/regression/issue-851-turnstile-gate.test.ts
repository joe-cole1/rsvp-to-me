// #851: enabled-Turnstile CSP coverage was optional and always skipped in the
// normal gates. Both gates must run an isolated, dummy-key production process.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enabled from "../../playwright.turnstile.config";
import disabled from "../../playwright.config";

describe("#851 enabled and disabled CAPTCHA gates", () => {
  it("runs the same blocking enabled check after normal E2E in CI and full preflight", () => {
    for (const filename of ["scripts/preflight.sh", ".github/workflows/ci.yml"]) {
      const source = readFileSync(filename, "utf8");
      expect(source.indexOf("bash scripts/check-turnstile-csp.sh")).toBeGreaterThan(
        source.indexOf("npm run test:e2e")
      );
      expect(source).toMatch(/TURNSTILE_SITE_KEY[=:]\s*""/);
      expect(source).toMatch(/TURNSTILE_SECRET_KEY[=:]\s*""/);
    }
    const script = readFileSync("scripts/check-turnstile-csp.sh", "utf8");
    expect(script).toContain("set -Eeuo pipefail");
    expect(script).toContain("export TURNSTILE_SITE_KEY=e2e-dummy-site-key");
    expect(script).toContain("export TURNSTILE_SECRET_KEY=e2e-dummy-secret-key");
    expect(script).toContain("playwright test --config playwright.turnstile.config.ts");
  });

  it("selects the enabled spec without retries, skips or reuse of the disabled server", () => {
    expect(disabled.testIgnore).toBe(enabled.testMatch);
    expect(enabled.testIgnore).toEqual([]);
    expect(enabled.retries).toBe(0);
    expect(enabled.webServer).toMatchObject({
      command: "npm start -- --port 3003",
      reuseExistingServer: false,
    });
    const spec = readFileSync("tests/e2e/csp-turnstile.e2e.ts", "utf8");
    expect(spec).not.toMatch(/test\.(?:skip|fixme)/);
    expect(spec).toContain("route.fulfill(");
    expect(spec).toContain("recordCspViolations(page)");
    expect(spec).toContain("readAuthCookies()");
    expect(readFileSync("tests/e2e/csp.e2e.ts", "utf8")).not.toContain("test.skip(");
  });
});

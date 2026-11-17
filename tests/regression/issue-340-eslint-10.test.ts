// #340 (November 2026): the ESLint 9 hold outlived Next.js 16.4's compatibility
// wrappers for removed rule-context APIs. Require the supported ESLint 10 line
// and exercise real diagnostics so a successful upgrade cannot hide lost rules.
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { atLeast } from "@/tests/helpers/dependency-versions";

const eslint = new ESLint();

async function diagnostics(code: string, filePath = "components/LintProbe.tsx") {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages;
}

describe("#340 ESLint 10 with the Next.js presets", () => {
  it("runs a supported ESLint major instead of the end-of-life 9 line", () => {
    expect(atLeast(ESLint.version, "10.0.0")).toBe(true);
  });

  it("declares the workflow YAML parser independently of ESLint's transitive tree", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8")
    ) as { devDependencies: Record<string, string> };
    expect(manifest.devDependencies["js-yaml"]).toBeTruthy();
  });

  it("detects React versions and reports missing display names and JSX keys", async () => {
    const messages = await diagnostics(`
      import { memo } from "react";
      export default memo(() => <div>{[<span />]}</div>);
    `);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "react/display-name", severity: 2 }),
        expect.objectContaining({ ruleId: "react/jsx-key", severity: 2 }),
      ])
    );
  });

  it("keeps both Hooks correctness and dependency diagnostics", async () => {
    const messages = await diagnostics(`
      import { useEffect } from "react";
      export default function Example({ enabled, value }: { enabled: boolean; value: string }) {
        if (enabled) {
          useEffect(() => { console.log(value); }, []);
        }
        return null;
      }
    `);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "react-hooks/rules-of-hooks", severity: 2 }),
        expect.objectContaining({ ruleId: "react-hooks/exhaustive-deps", severity: 1 }),
      ])
    );
  });

  it("keeps image and ARIA accessibility checks", async () => {
    const messages = await diagnostics(`
      export default function Example() {
        return <><img src="/probe.png" /><div aria-labl="probe" role="checkbox" /></>;
      }
    `);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "jsx-a11y/alt-text", severity: 1 }),
        expect.objectContaining({ ruleId: "jsx-a11y/aria-props", severity: 1 }),
        expect.objectContaining({ ruleId: "jsx-a11y/role-has-required-aria-props", severity: 1 }),
      ])
    );
  });

  it("keeps import and TypeScript checks", async () => {
    const messages = await diagnostics("const unused = 1; export default { value: 1 as any }; ");
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "import/no-anonymous-default-export", severity: 1 }),
        expect.objectContaining({ ruleId: "@typescript-eslint/no-explicit-any", severity: 2 }),
        expect.objectContaining({ ruleId: "@typescript-eslint/no-unused-vars", severity: 1 }),
      ])
    );
  });

  it("enforces Next.js markup rules while retaining the email exceptions", async () => {
    const code = `export default function Example() {
      return <html><head><title>Probe</title></head><body><img src="/probe.png" alt="Probe" /></body></html>;
    }`;
    const page = await diagnostics(code, "components/DocumentProbe.tsx");
    expect(page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "@next/next/no-head-element", severity: 1 }),
        expect.objectContaining({ ruleId: "@next/next/no-img-element", severity: 1 }),
      ])
    );
    expect(await diagnostics(code, "emails/LintProbe.tsx")).toEqual([]);
  });

  it("accepts valid TSX and JavaScript browser/Node globals", async () => {
    expect(await diagnostics("export default function Example() { return <p>Probe</p>; }")).toEqual(
      []
    );
    expect(
      await diagnostics(
        "export const probe = () => window.document.title + process.env.NODE_ENV;",
        "scripts/lint-probe.js"
      )
    ).toEqual([]);
  });
});

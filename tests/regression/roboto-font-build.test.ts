// October 2026, PR #699: Google returned extensionless Roboto URLs with embedded
// '&' parameters. Next 16.3's Google loader misparsed them as multiple queries,
// failing the AMD64 Turbopack image build. Exercise the actual theme-font module
// with that response shape and verify the bundled font reaches production CSS.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const requireFromRoot = createRequire(join(ROOT, "package.json"));

it("builds the theme fonts despite Google's extensionless Roboto response", () => {
  const scratch = join(ROOT, ".vitest");
  mkdirSync(scratch, { recursive: true });
  const fixture = mkdtempSync(join(scratch, "roboto-font-"));
  try {
    mkdirSync(join(fixture, "app", "font-files"), { recursive: true });
    copyFileSync(join(ROOT, "app", "fonts.ts"), join(fixture, "app", "fonts.ts"));
    const asset = readFileSync(join(ROOT, "app", "font-files", "roboto-normal.woff2"));
    writeFileSync(join(fixture, "app", "font-files", "roboto-normal.woff2"), asset);
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ private: true }));
    writeFileSync(
      join(fixture, "next.config.js"),
      `module.exports = ${JSON.stringify({
        turbopack: { root: ROOT },
        experimental: { cpus: 1 },
      })};`
    );
    writeFileSync(
      join(fixture, "app", "layout.tsx"),
      `
      import type { ReactNode } from "react";
      import { themeFontVariables } from "./fonts";
      export default function Layout({ children }: { children: ReactNode }) {
        return <html className={themeFontVariables}><body>{children}</body></html>;
      }
    `
    );
    writeFileSync(
      join(fixture, "app", "page.tsx"),
      `
      export default function Page() {
        return <h1 style={{ fontFamily: "var(--font-roboto)" }}>Roboto</h1>;
      }
    `
    );
    const mockedResponses = join(fixture, "google-responses.cjs");
    writeFileSync(
      mockedResponses,
      `
      const families = [
        ["Playfair Display", "400..900"], ["DM Serif Display", "400"],
        ["Lora", "400..700"], ["Bebas Neue", "400"], ["Righteous", "400"],
        ["Fredoka", "300..700"], ["Pacifico", "400"], ["Dancing Script", "400..700"],
        ["Caveat", "400..700"], ["Space Grotesk", "300..700"], ["Outfit", "100..900"],
        ["Roboto", "400;700"]
      ];
      module.exports = Object.fromEntries(families.map(([family, weights]) => [
        "https://fonts.googleapis.com/css2?family=" + family.replace(/ /g, "+") + ":wght@" + weights + "&display=swap",
        family === "Roboto"
          ? "@font-face { font-family: 'Roboto'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/l/font?kit=regression&skey=regression&v=v50) format('woff2'); }"
          // Unrelated families need only CSS for this font-build regression.
          // No remote font files or network requests are needed by the fixture.
          : "@font-face { font-family: '" + family + "'; font-style: normal; font-weight: 400; }"
      ]));
    `
    );

    const build = spawnSync(
      process.execPath,
      [requireFromRoot.resolve("next/dist/bin/next"), "build", fixture],
      {
        cwd: fixture,
        encoding: "utf8",
        timeout: 60000,
        env: {
          ...process.env,
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
          NEXT_FONT_GOOGLE_MOCKED_RESPONSES: mockedResponses,
        },
      }
    );
    expect(build.status, `${build.error ?? ""}\n${build.stdout}\n${build.stderr}`).toBe(0);
    expect(build.stdout).toContain("(Turbopack)");

    const staticDir = join(fixture, ".next", "static");
    const emitted = readdirSync(staticDir, { recursive: true, encoding: "utf8" }).map((path) =>
      join(staticDir, path)
    );
    const styles = emitted
      .filter((path) => path.endsWith(".css"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(styles).toContain("--font-roboto");
    expect(styles).toMatch(/font-weight:\s*400 700/);
    expect(styles).toMatch(/font-display:\s*swap/);
    expect(
      emitted
        .filter((path) => path.endsWith(".woff2"))
        .some((path) => readFileSync(path).equals(asset))
    ).toBe(true);
    const html = readFileSync(join(fixture, ".next", "server", "app", "index.html"), "utf8");
    expect(html).not.toMatch(/<link[^>]+as="font"/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 75000);

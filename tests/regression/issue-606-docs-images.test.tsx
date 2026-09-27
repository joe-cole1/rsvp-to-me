// Issue #606 (September 2026): repository-relative screenshot paths rendered on
// GitHub but would request nonexistent /public/... assets in the in-app guides.
// Render the actual guide content to verify it uses the bundled static assets.
import React from "react";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocsPanel from "@/components/docs/DocsPanel";

function renderDoc(content: string) {
  return renderToStaticMarkup(
    <DocsPanel
      docs={[{ slug: "example", title: "Example", description: "", category: "Guides", content }]}
    />
  );
}

describe("documentation screenshots", () => {
  it.each([
    ["README.md", "event-guest-view.png", "host-dashboard.png"],
    ["docs/host/guest-list.md", "guest-management.png"],
    ["docs/host/customizing-your-page.md", "theme-customization.png"],
  ])("renders %s images from local static assets", (file, ...images) => {
    const content = readFileSync(path.join(process.cwd(), file), "utf8").replace(
      /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
      ""
    );
    const html = renderDoc(content);
    for (const image of images) {
      expect(html).toContain(`src="/docs/images/${image}"`);
      expect(existsSync(path.join(process.cwd(), "public/docs/images", image))).toBe(true);
    }
    expect(html).not.toContain("Screenshot coming soon");
    expect(html).not.toContain('src="../../public/');
  });

  it("preserves safe existing URLs and the default unsafe-URL filtering", () => {
    const html = renderDoc(
      "![Existing](/api/uploads/example.png)\n\n" +
        "![External](https://example.com/image.png)\n\n" +
        "[Unsafe](javascript:alert%281%29)"
    );
    expect(html).toContain('src="/api/uploads/example.png"');
    expect(html).toContain('src="https://example.com/image.png"');
    expect(html).not.toContain("javascript:");
  });
});

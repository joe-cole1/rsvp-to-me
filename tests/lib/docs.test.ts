import { describe, it, expect, vi } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import { loadDocs } from "@/lib/docs";

// React.cache passes through in the test environment (no request dedup needed).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

const DOCS_ROOT = path.join(process.cwd(), "docs");

describe("lib/docs.ts", () => {
  it("loads admin docs from docs/admin with frontmatter", async () => {
    const docs = await loadDocs("admin");
    const slugs = docs.map((d) => d.slug).sort();
    expect(slugs).toEqual(["admin", "configuration", "email", "installation", "sms", "upgrading"]);
    for (const doc of docs) {
      expect(doc.audience).toBe("admin");
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.category.length).toBeGreaterThan(0);
      expect(doc.content.length).toBeGreaterThan(0);
      // Frontmatter must be stripped from the rendered body.
      expect(doc.content.startsWith("---")).toBe(false);
    }
  });

  it("sorts docs by frontmatter order", async () => {
    const docs = await loadDocs("admin");
    const orders = docs.map((d) => d.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(docs[0].slug).toBe("installation"); // order 10
  });

  it("loads host docs from docs/host", async () => {
    const docs = await loadDocs("host");
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.map((d) => d.slug)).toContain("getting-started");
    expect(docs.every((d) => d.audience === "host")).toBe(true);
    // Host docs carry the required frontmatter just like admin docs.
    for (const doc of docs) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.category.length).toBeGreaterThan(0);
      expect(doc.content.startsWith("---")).toBe(false);
    }
  });

  it("has unique slugs per audience", async () => {
    const docs = await loadDocs("admin");
    const slugs = docs.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // Convention guard: every markdown guide must live in an audience subfolder,
  // never loose in docs/ root (the loader only scans docs/<audience>/).
  it("has no stray markdown files in the docs/ root", () => {
    const rootMarkdown = readdirSync(DOCS_ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);
    expect(rootMarkdown).toEqual([]);
  });
});

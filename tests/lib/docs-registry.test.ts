import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { DOCS, docsForRole, getDocBySlug } from "@/lib/docs-registry";

const REPO_ROOT = process.cwd();

describe("lib/docs-registry.ts", () => {
  it("every registered doc file exists on disk", () => {
    for (const doc of DOCS) {
      const fullPath = path.join(REPO_ROOT, doc.file);
      expect(existsSync(fullPath), `${doc.file} (slug: ${doc.slug}) is missing`).toBe(true);
    }
  });

  it("has unique slugs", () => {
    const slugs = DOCS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // Sync guard: every markdown guide in docs/ must be registered so it shows in
  // the portal. This automates the AGENTS.md In-App Documentation Portal Sync Rule.
  it("every docs/*.md file is registered", () => {
    const registeredFiles = new Set(DOCS.map((d) => d.file));
    const docsDir = path.join(REPO_ROOT, "docs");
    const markdownFiles = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
    for (const file of markdownFiles) {
      expect(
        registeredFiles.has(`docs/${file}`),
        `docs/${file} is not in lib/docs-registry.ts — register it or remove it`
      ).toBe(true);
    }
  });

  it("docsForRole gates operator docs to ADMIN", () => {
    const adminDocs = docsForRole("ADMIN");
    const hostDocs = docsForRole("HOST");
    const guestDocs = docsForRole("GUEST");

    expect(adminDocs).toEqual(DOCS); // admins see everything
    expect(hostDocs.every((d) => d.access === "host")).toBe(true);
    expect(hostDocs.length).toBeLessThan(adminDocs.length);
    expect(guestDocs).toHaveLength(0);

    // Operator/infra docs must never leak to a host.
    expect(hostDocs.some((d) => d.slug === "installation")).toBe(false);
    expect(hostDocs.some((d) => d.slug === "configuration")).toBe(false);
  });

  it("getDocBySlug resolves known slugs and rejects unknown", () => {
    expect(getDocBySlug("features")?.file).toBe("docs/features.md");
    expect(getDocBySlug("nope")).toBeUndefined();
  });
});

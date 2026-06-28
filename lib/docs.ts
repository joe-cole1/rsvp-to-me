import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

/**
 * Frontmatter-driven documentation loader for the in-app Documentation portal.
 *
 * Markdown guides live under `docs/<audience>/*.md` (e.g. `docs/admin/`,
 * `docs/host/`) and ship in the production image via the Dockerfile. Each file
 * carries a small YAML frontmatter block:
 *
 *   ---
 *   title: Installation
 *   description: Docker setup, deployment, HTTPS, and troubleshooting.
 *   category: Getting Started
 *   audience: admin
 *   order: 10
 *   ---
 *
 * The sidebar/registry is derived by scanning the folder and reading that
 * frontmatter — there is no hand-maintained list to keep in sync. This module
 * imports `node:fs` and is therefore only usable from Server Components /
 * server actions.
 */

export type DocAudience = "admin" | "host";

export interface LoadedDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  audience: DocAudience;
  order: number;
  /** Markdown body, with the frontmatter block stripped. */
  content: string;
}

const DOCS_ROOT = path.join(process.cwd(), "docs");

/** Minimal YAML frontmatter parser for flat `key: value` blocks (no deps). */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/**
 * Load every doc for an audience, sorted by `order` then title. Returns an empty
 * array if the audience folder does not exist yet (e.g. `docs/host/`).
 */
export const loadDocs = cache(async (audience: DocAudience): Promise<LoadedDoc[]> => {
  const dir = path.join(DOCS_ROOT, audience);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const docs = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: data.title || file.replace(/\.md$/, ""),
        description: data.description || "",
        category: data.category || "General",
        audience: (data.audience as DocAudience) || audience,
        order: data.order ? Number(data.order) : 999,
        content: body,
      } satisfies LoadedDoc;
    })
  );

  docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return docs;
});

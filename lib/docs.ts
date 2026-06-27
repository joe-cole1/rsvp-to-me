import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { DOCS, docsForRole, getDocBySlug, type DocEntry, type DocRole } from "@/lib/docs-registry";

/**
 * Server-side markdown loader for the in-app Documentation portal.
 *
 * Markdown lives in the repo (`docs/*.md`, `README.md`) and is shipped into the
 * production container by the Dockerfile runner stage, so it can be read from
 * disk at request time. This module imports `node:fs` and is therefore only
 * usable from Server Components / server actions.
 */

export interface LoadedDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

function resolveDocPath(entry: DocEntry): string {
  return path.join(process.cwd(), entry.file);
}

async function readDoc(entry: DocEntry): Promise<LoadedDoc> {
  const content = await readFile(resolveDocPath(entry), "utf8");
  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    category: entry.category,
    content,
  };
}

/**
 * Load a single doc by slug, authorized against the caller's role. Returns null
 * if the slug is unknown or the role may not read it.
 */
export const loadDoc = cache(async (slug: string, role: DocRole): Promise<LoadedDoc | null> => {
  const entry = getDocBySlug(slug);
  if (!entry) return null;
  if (!docsForRole(role).some((d) => d.slug === slug)) return null;
  return readDoc(entry);
});

/**
 * Load every doc the role may read, in registry order. Used to hydrate the
 * portal client so doc switching and search happen instantly without round-trips.
 */
export const loadVisibleDocs = cache(async (role: DocRole): Promise<LoadedDoc[]> => {
  const entries = docsForRole(role);
  return Promise.all(entries.map(readDoc));
});

export { DOCS };

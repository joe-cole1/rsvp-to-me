/**
 * Documentation portal registry — the single source of truth for which markdown
 * guides appear in the in-app Documentation portal (`/docs`), their titles,
 * categories, ordering, and who may read them.
 *
 * SYNC RULE: whenever a guide in `docs/` (or a root-level doc) is added, removed,
 * or renamed, update this list. A regression test (`tests/lib/docs-registry.test.ts`)
 * fails if a `docs/*.md` file is missing an entry here. New root-level docs also
 * require a `COPY` line in the Dockerfile runner stage so they ship at runtime.
 */

export type DocAccess = "host" | "admin";

export interface DocEntry {
  /** URL key used in `?doc=` and for resolving in-app links. */
  slug: string;
  /** Sidebar label. */
  title: string;
  /** One-line description shown under the title. */
  description: string;
  /** Group header; rendered in CATEGORY_ORDER order. */
  category: string;
  /** Path relative to the repo root, e.g. "docs/installation.md" | "README.md". */
  file: string;
  /** "host" docs are visible to HOST + ADMIN; "admin" docs to ADMIN only. */
  access: DocAccess;
}

export const CATEGORY_ORDER = ["Getting Started", "Configuration", "Usage", "Maintenance"] as const;

export const DOCS: DocEntry[] = [
  {
    slug: "readme",
    title: "Overview",
    description: "What RSVP to Me is, the tech stack, and a quick start.",
    category: "Getting Started",
    file: "README.md",
    access: "host",
  },
  {
    slug: "installation",
    title: "Installation",
    description: "Docker setup, deployment, HTTPS, and troubleshooting.",
    category: "Getting Started",
    file: "docs/installation.md",
    access: "admin",
  },
  {
    slug: "configuration",
    title: "Configuration",
    description: "Environment variable reference for every subsystem.",
    category: "Configuration",
    file: "docs/configuration.md",
    access: "admin",
  },
  {
    slug: "email",
    title: "Email Setup",
    description: "SMTP and Cloudflare email provider configuration.",
    category: "Configuration",
    file: "docs/email.md",
    access: "admin",
  },
  {
    slug: "sms",
    title: "SMS Setup",
    description: "Twilio integration, account setup, limits, and costs.",
    category: "Configuration",
    file: "docs/sms.md",
    access: "admin",
  },
  {
    slug: "features",
    title: "Features",
    description: "Themes, RSVP, polls, potlucks, check-in, and co-hosting.",
    category: "Usage",
    file: "docs/features.md",
    access: "host",
  },
  {
    slug: "admin",
    title: "Admin Panel",
    description: "Admin walkthrough: users, system config, backups, themes.",
    category: "Usage",
    file: "docs/admin.md",
    access: "admin",
  },
  {
    slug: "upgrading",
    title: "Upgrading",
    description: "Safe upgrade procedures, backups, migrations, and rollback.",
    category: "Maintenance",
    file: "docs/upgrading.md",
    access: "admin",
  },
];

export type DocRole = "GUEST" | "HOST" | "ADMIN";

/** Docs visible to the given role. GUESTs see nothing; HOSTs see "host" docs; ADMINs see all. */
export function docsForRole(role: DocRole): DocEntry[] {
  if (role === "ADMIN") return DOCS;
  if (role === "HOST") return DOCS.filter((d) => d.access === "host");
  return [];
}

/** Look up a doc by slug (registry-wide, before role filtering). */
export function getDocBySlug(slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug === slug);
}

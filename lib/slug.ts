import { db } from "./db";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "event";
  let slug = base;
  let attempt = 0;

  while (true) {
    const existing = await db.event.findUnique({ where: { slug } });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

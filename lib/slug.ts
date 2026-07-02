import { randomBytes } from "crypto";
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

// L-7: bound the collision probe so a pathological number of same-title
// events can't turn slug generation into an unbounded sequential query loop.
const MAX_SEQUENTIAL_ATTEMPTS = 10;
const MAX_RANDOM_ATTEMPTS = 4;

export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "event";

  // Friendly sequential suffixes first (base, base-1, base-2, …), bounded.
  let slug = base;
  for (let attempt = 1; attempt <= MAX_SEQUENTIAL_ATTEMPTS; attempt++) {
    const existing = await db.event.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${base}-${attempt}`;
  }

  // Heavy collision territory: switch to CSPRNG suffixes with growing entropy
  // instead of scanning base-11, base-12, … indefinitely.
  for (let i = 0; i < MAX_RANDOM_ATTEMPTS; i++) {
    const candidate = `${base}-${randomBytes(3 + i).toString("hex")}`;
    const existing = await db.event.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }

  throw new Error("Could not generate a unique slug — please try a different event title.");
}

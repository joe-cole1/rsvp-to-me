import { describe, it, expect, beforeEach } from "vitest";
import { truncateAll, db } from "../helpers/db";
import { generateRandomSlug, generateUniqueSlug } from "@/lib/slug";

beforeEach(async () => {
  await truncateAll();
});

describe("generateUniqueSlug — real DB integration", () => {
  it.each(["UNLISTED", "PRIVATE"] as const)(
    "persists opaque %s addresses without rewriting older links",
    async (visibility) => {
      const host = await seedHost();
      await seedEvent("wine-night", host.id);
      const slug = await generateUniqueSlug("Wine Night", visibility);
      expect(slug).toMatch(/^[A-Za-z0-9]{6}(?:[A-Za-z0-9]{2}){0,3}$/);
      await seedEvent(slug, host.id);
      const next = await generateUniqueSlug("Wine Night", visibility);
      expect(next).not.toBe(slug);
      expect(await db.event.findUnique({ where: { slug: "wine-night" } })).not.toBeNull();
    }
  );

  it("checks prefixed generated links against the same database namespace", async () => {
    const host = await seedHost();
    const { slug, code } = await generateRandomSlug("wine-night");
    await seedEvent(slug, host.id);
    expect(slug).toBe(`wine-night-${code}`);
    expect((await generateRandomSlug("wine-night")).slug).not.toBe(slug);
  });
  async function seedEvent(slug: string, hostId: string) {
    return db.event.create({
      data: {
        title: "Test Event",
        slug,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        startAt: new Date("2030-12-01T20:00:00Z"),
        timezone: "America/New_York",
        locationType: "PHYSICAL",
        hostId,
      },
    });
  }

  async function seedHost() {
    return db.user.create({
      data: { email: `host-${Date.now()}@test.com`, name: "Host", role: "HOST" },
    });
  }

  it("returns the base slug when no conflict exists", async () => {
    const slug = await generateUniqueSlug("Wine Night");
    expect(slug).toBe("wine-night");
  });

  it("appends -1 when base slug is taken", async () => {
    const host = await seedHost();
    await seedEvent("wine-night", host.id);

    const slug = await generateUniqueSlug("Wine Night");
    expect(slug).toBe("wine-night-1");
  });

  it("appends -2 when base and -1 are both taken", async () => {
    const host = await seedHost();
    await seedEvent("wine-night", host.id);
    await seedEvent("wine-night-1", host.id);

    const slug = await generateUniqueSlug("Wine Night");
    expect(slug).toBe("wine-night-2");
  });

  it("falls back to 'event' when title slugifies to empty string", async () => {
    const slug = await generateUniqueSlug("!!!");
    expect(slug).toBe("event");
  });
});

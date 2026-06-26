import { describe, it, expect, beforeEach } from "vitest";
import { truncateAll, db } from "../helpers/db";
import { generateUniqueSlug } from "@/lib/slug";

beforeEach(async () => {
  await truncateAll();
});

describe("generateUniqueSlug — real DB integration", () => {
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

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { event: { findUnique } },
}));

import OpenGraphImage, {
  contentType as openGraphContentType,
  size as openGraphSize,
} from "@/app/e/[slug]/opengraph-image";
import TwitterImage, {
  contentType as twitterContentType,
  size as twitterSize,
} from "@/app/e/[slug]/twitter-image";
import { getEventSocialImageCopy } from "@/app/e/[slug]/social-image";
import type { SocialEvent } from "@/lib/event-social";

const event = {
  slug: "summer-party",
  title: "Summer Party",
  description: "An evening with friends.",
  startAt: new Date("2030-07-20T20:00:00Z"),
  timezone: "America/New_York",
  visibility: "PUBLIC",
  status: "PUBLISHED",
  passwordHash: null,
  hostDisplayName: "The Party Committee",
  host: { name: "Primary Host" },
  theme: {
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: "#a855f7",
    coverImageUrl: null,
  },
} satisfies SocialEvent & {
  hostDisplayName: string;
  host: { name: string };
};

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(event);
});

describe("event social image endpoints", () => {
  it("renders a 1200x630 PNG Open Graph image", async () => {
    const response = await OpenGraphImage({
      params: Promise.resolve({ slug: "summer-party" }),
    } as PageProps<"/e/[slug]">);

    expect(openGraphSize).toEqual({ width: 1200, height: 630 });
    expect(openGraphContentType).toBe("image/png");
    expect(response.headers.get("content-type")).toContain("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
  });

  it("renders the matching X/Twitter image and selects privacy-gating fields", async () => {
    const response = await TwitterImage({
      params: Promise.resolve({ slug: "summer-party" }),
    } as PageProps<"/e/[slug]">);

    expect(twitterSize).toEqual(openGraphSize);
    expect(twitterContentType).toBe("image/png");
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "summer-party" },
        select: expect.objectContaining({
          visibility: true,
          status: true,
          passwordHash: true,
          hostDisplayName: true,
          host: { select: { name: true } },
        }),
      })
    );
  });

  it("places the event title, host display name, and date on shareable artwork only", () => {
    expect(getEventSocialImageCopy(event)).toEqual({
      title: "Summer Party",
      hostLine: "Hosted by The Party Committee",
      date: "Saturday, July 20, 2030",
    });

    expect(
      getEventSocialImageCopy({ ...event, visibility: "PRIVATE", passwordHash: "secret" })
    ).toEqual({ title: "Event invitation", hostLine: null, date: null });
  });
});

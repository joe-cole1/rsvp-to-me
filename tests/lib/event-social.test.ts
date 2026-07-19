import { describe, expect, it } from "vitest";
import {
  buildEventSocialMetadata,
  isEventSociallyShareable,
  type SocialEvent,
} from "@/lib/event-social";

const publishedEvent: SocialEvent = {
  slug: "summer-party",
  title: "Summer Party",
  description: "An evening with friends.",
  startAt: new Date("2030-07-20T20:00:00Z"),
  timezone: "America/New_York",
  visibility: "PUBLIC",
  status: "PUBLISHED",
  passwordHash: null,
  theme: {
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: "#a855f7",
    coverImageUrl: "/api/uploads/cover.jpg",
  },
};

describe("event social metadata", () => {
  it("builds canonical Open Graph and X metadata for a published public event", () => {
    const metadata = buildEventSocialMetadata(publishedEvent, publishedEvent.slug);

    expect(metadata.title).toBe("Summer Party");
    expect(metadata.description).toBe("An evening with friends.");
    expect(metadata.alternates?.canonical).toBe("/e/summer-party");
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      title: "Summer Party",
      description: "An evening with friends.",
      url: "/e/summer-party",
      images: [
        {
          url: "/e/summer-party/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Summer Party event invitation",
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Summer Party",
      images: [{ url: "/e/summer-party/twitter-image", alt: "Summer Party event invitation" }],
    });
  });

  it("allows rich Unlisted previews but prevents search indexing", () => {
    const event = { ...publishedEvent, visibility: "UNLISTED" as const };
    const metadata = buildEventSocialMetadata(event, event.slug);

    expect(isEventSociallyShareable(event)).toBe(true);
    expect(metadata.title).toBe("Summer Party");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it.each([
    ["private", { visibility: "PRIVATE" as const }],
    ["password-protected", { passwordHash: "secret-hash" }],
    ["draft", { status: "DRAFT" as const }],
    ["cancelled", { status: "CANCELLED" as const }],
    ["deleted", { status: "DELETED" as const }],
  ])("does not expose %s event details", (_label, overrides) => {
    const event = { ...publishedEvent, ...overrides };
    const metadata = buildEventSocialMetadata(event, event.slug);
    const serialized = JSON.stringify(metadata);

    expect(isEventSociallyShareable(event)).toBe(false);
    expect(metadata.title).toBe("Event invitation");
    expect(metadata.description).toBe("View this event invitation on RSVP to Me.");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(serialized).not.toContain("Summer Party");
    expect(serialized).not.toContain("evening with friends");
    expect(serialized).not.toContain("cover.jpg");
  });

  it("uses generic metadata for a missing event without leaking the requested slug into copy", () => {
    const metadata = buildEventSocialMetadata(null, "guessed-secret-event");

    expect(metadata.title).toBe("Event invitation");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.description).not.toContain("guessed-secret-event");
    expect(metadata.alternates?.canonical).toBe("/e/guessed-secret-event");
  });

  it("uses a date fallback and compacts long descriptions", () => {
    const fallback = buildEventSocialMetadata(
      { ...publishedEvent, description: null },
      publishedEvent.slug
    );
    expect(fallback.description).toContain("Saturday, July 20, 2030");

    const long = buildEventSocialMetadata(
      { ...publishedEvent, description: `  ${"word ".repeat(80)} ` },
      publishedEvent.slug
    );
    expect(String(long.description).length).toBeLessThanOrEqual(200);
    expect(long.description).not.toContain("  ");
  });
});

import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/e/[slug]/layout";

describe("event segment social metadata fallback", () => {
  it("keeps not-found event routes generic and tied to the requested canonical URL", async () => {
    const metadata = await generateMetadata({
      children: null,
      params: Promise.resolve({ slug: "missing-or-protected-event" }),
    });

    expect(metadata.title).toBe("Event invitation");
    expect(metadata.description).toBe("View this event invitation on RSVP to Me.");
    expect(metadata.alternates?.canonical).toBe("/e/missing-or-protected-event");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({
      title: "Event invitation",
      url: "/e/missing-or-protected-event",
      images: [expect.objectContaining({ url: "/e/missing-or-protected-event/opengraph-image" })],
    });
  });
});

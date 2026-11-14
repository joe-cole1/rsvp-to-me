// Root cause: social artwork passed arbitrary stored cover URLs to the server
// image renderer, allowing external fetches and failures from a malformed row.
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ event: vi.fn(), artwork: undefined as ReactNode }));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: state.event } } }));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: ReactNode) {
      state.artwork = element;
    }
  },
}));
import { renderEventSocialImage } from "@/app/e/[slug]/social-image";
const valid = "/api/uploads/12345678-1234-4123-8123-123456789abc.png";
beforeEach(() => vi.clearAllMocks());
it.each([
  "https://external.example/cover.png",
  "http://127.0.0.1/internal.png",
  "/api/uploads/../private.png",
  valid,
])("only passes an application upload to social artwork: %s", async (coverImageUrl) => {
  state.event.mockResolvedValue({
    slug: "party",
    title: "Party",
    description: null,
    startAt: new Date("2099-01-01"),
    timezone: "UTC",
    visibility: "PUBLIC",
    status: "PUBLISHED",
    passwordHash: null,
    hostDisplayName: null,
    host: { name: "Host" },
    theme: {
      coverImageUrl,
      gradientFrom: "#112233",
      gradientTo: "#334455",
      accentColor: "#445566",
    },
  });
  await renderEventSocialImage("party");
  const html = renderToStaticMarkup(state.artwork);
  if (coverImageUrl === valid) expect(html).toContain(`http://localhost:3000${valid}`);
  else {
    expect(html).not.toContain(coverImageUrl);
    expect(html).not.toContain("<img");
  }
});

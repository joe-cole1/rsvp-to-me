// #853 root cause: the RSVP route inherited the generic event-layout title. Match
// guest-list metadata's existing public-title rule without exposing protected titles.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: m.find } } }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: vi.fn() }));
import { generateMetadata as rsvpMetadata } from "@/app/e/[slug]/rsvp/page";
import { generateMetadata as guestsMetadata } from "@/app/e/[slug]/guests/page";
const event = {
  title: "Secret Picnic",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  passwordHash: null,
};
const props = { params: Promise.resolve({ slug: "picnic" }), searchParams: Promise.resolve({}) };
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
describe("#853 route titles", () => {
  it.each([
    ["RSVP", rsvpMetadata],
    ["Guest list", guestsMetadata],
  ] as const)("names the %s page and shareable event exactly once", async (page, metadata) => {
    m.find.mockResolvedValue(event);
    expect((await metadata(props)).title).toEqual({
      absolute: `${page} · Secret Picnic | RSVP to Me`,
    });
  });
  it.each([
    { ...event, visibility: "PRIVATE" },
    { ...event, status: "DRAFT" },
    { ...event, status: "CANCELLED" },
    { ...event, status: "DELETED" },
    { ...event, passwordHash: "hash" },
    null,
  ])("does not expose a protected or missing event title (%j)", async (record) => {
    m.find.mockResolvedValue(record);
    expect((await rsvpMetadata(props)).title).toEqual({ absolute: "RSVP | RSVP to Me" });
    expect((await guestsMetadata(props)).title).toEqual({ absolute: "Guest list | RSVP to Me" });
  });
});

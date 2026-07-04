import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique, mockGetSessionUser, mockRsvpFindFirst, mockCookieGet } = vi.hoisted(
  () => ({
    mockEventFindUnique: vi.fn(),
    mockGetSessionUser: vi.fn(),
    mockRsvpFindFirst: vi.fn(),
    mockCookieGet: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVP: { findFirst: mockRsvpFindFirst },
  },
}));
vi.mock("@/lib/session-user", () => ({ getSessionUser: mockGetSessionUser }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

import { GET } from "@/app/e/[slug]/calendar.ics/route";

const event = {
  id: "evt_1",
  slug: "wine-night",
  title: "Wine Night",
  description: null,
  startAt: new Date("2026-07-04T23:00:00Z"),
  endAt: null,
  locationName: "The Cole Residence",
  locationAddress: null,
  virtualUrl: null,
  status: "PUBLISHED",
  // SEC-34 gate fields:
  visibility: "PUBLIC",
  passwordHash: null,
  hostId: "host_1",
  coHosts: [] as { userId: string }[],
};

function req(slug = "wine-night", query = "") {
  return GET(new Request(`http://localhost/e/${slug}/calendar.ics${query}`), {
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue(null);
  mockRsvpFindFirst.mockResolvedValue(null);
  mockCookieGet.mockReturnValue(undefined);
});

describe("GET /e/[slug]/calendar.ics", () => {
  it("returns a downloadable ICS file for an existing public event", async () => {
    mockEventFindUnique.mockResolvedValue(event);
    const res = await req();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    expect(res.headers.get("Content-Disposition")).toContain('filename="wine-night.ics"');
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("UID:evt_1@rsvp-to-me");
    expect(body).toContain("SUMMARY:Wine Night");
  });

  it("returns 404 for a missing event", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const res = await req("nope");
    expect(res.status).toBe(404);
  });

  it("returns 404 for a deleted event", async () => {
    mockEventFindUnique.mockResolvedValue({ ...event, status: "DELETED" });
    const res = await req();
    expect(res.status).toBe(404);
  });

  // SEC-34: the ICS export must honor the event's visibility/password gate.
  it("returns 404 for a PRIVATE event to an anonymous caller (gate bypass fix)", async () => {
    mockEventFindUnique.mockResolvedValue({ ...event, visibility: "PRIVATE" });
    const res = await req();
    expect(res.status).toBe(404);
  });

  it("returns 404 for a password-protected event to an anonymous caller", async () => {
    mockEventFindUnique.mockResolvedValue({ ...event, passwordHash: "hash" });
    const res = await req();
    expect(res.status).toBe(404);
  });

  it("serves the ICS to a valid RSVP token holder on a PRIVATE event", async () => {
    mockEventFindUnique.mockResolvedValue({ ...event, visibility: "PRIVATE" });
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp_1" }); // hasValidToken lookup
    const res = await req("wine-night", "?token=tok-123");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
  });
});

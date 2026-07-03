import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/e/[slug]/calendar.ics/route";

const { mockEventFindUnique } = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: {
      findUnique: mockEventFindUnique,
    },
  },
}));

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
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /e/[slug]/calendar.ics", () => {
  it("returns a downloadable ICS file for an existing event", async () => {
    mockEventFindUnique.mockResolvedValue(event);
    const res = await GET(new Request("http://localhost/e/wine-night/calendar.ics"), {
      params: Promise.resolve({ slug: "wine-night" }),
    });
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
    const res = await GET(new Request("http://localhost/e/nope/calendar.ics"), {
      params: Promise.resolve({ slug: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a deleted event", async () => {
    mockEventFindUnique.mockResolvedValue({ ...event, status: "DELETED" });
    const res = await GET(new Request("http://localhost/e/wine-night/calendar.ics"), {
      params: Promise.resolve({ slug: "wine-night" }),
    });
    expect(res.status).toBe(404);
  });
});

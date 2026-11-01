// PR #777 report / task 01a197b1 — dynamic downloads lacked an explicit
// no-store policy, allowing clients or proxies to reuse stale guest CSV data.
import { describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

const { findEvent, findRsvps, getSession } = vi.hoisted(() => ({
  findEvent: vi.fn(),
  findRsvps: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { event: { findUnique: findEvent }, rSVP: { findMany: findRsvps } },
}));
vi.mock("@/lib/session", () => ({ getSession }));
import { GET } from "@/app/e/[slug]/guests.csv/route";

const downloads = [
  "/e/party/guests.csv",
  "/e/party/calendar.ics",
  "/api/admin/backups/backup.sql.gz",
];

describe("01a197b1: dynamic download cache policy", () => {
  it.each(downloads.flatMap((path) => [path, `${path}?token=example&download=1`]))(
    "prevents storage and preserves security headers for %s",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://example.com${path}`,
        nextConfig,
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(response.headers.get("content-security-policy")).toContain("default-src");
    }
  );

  it.each([
    "/e/party/guestsXcsv",
    "/e/party/calendarXics",
    "/e/nested/party/guests.csv",
    "/e/party/guests.csv/extra",
    "/api/admin/backups/nested/file.sql",
    "/api/admin/backups",
    "/api/uploads/image.png",
    "/e/party/opengraph-image",
    "/e/party/twitter-image",
  ])("leaves other route cache policies untouched: %s", async (path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://example.com${path}`,
      nextConfig,
    });
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("reads the latest stored RSVP rows on repeated CSV GETs at the identical URL", async () => {
    getSession.mockResolvedValue({ userId: "host", role: "HOST" });
    findEvent.mockImplementation(async ({ select }) =>
      select.timezone
        ? { timezone: "UTC", rsvpFields: [] }
        : { id: "event", hostId: "host", coHosts: [] }
    );
    const row = {
      guestName: "Original guest",
      guestEmail: null,
      guestPhone: null,
      status: "GOING",
      plusOneCount: 0,
      approved: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      answers: [],
      checkIn: null,
    };
    findRsvps.mockResolvedValueOnce([row]).mockResolvedValueOnce([
      { ...row, guestName: "Updated guest", status: "NO" },
      { ...row, guestName: "New submission" },
    ]);
    const download = () =>
      GET(new Request("https://example.com/e/party/guests.csv"), {
        params: Promise.resolve({ slug: "party" }),
      });
    expect(await (await download()).text()).toContain('"Original guest"');
    const latest = await (await download()).text();
    expect(latest).toContain('"Updated guest"');
    expect(latest).toContain('"New submission"');
    expect(latest).toContain('"NO"');
    expect(latest).not.toContain("Original guest");
    expect(findRsvps).toHaveBeenCalledTimes(2);
  });
});

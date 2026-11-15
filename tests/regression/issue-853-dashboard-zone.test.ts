// #853 root cause: dashboard action projections discarded each event's timezone,
// leaving cards to format in the browser's local zone (audit tracker #852).
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ events: vi.fn(), rsvps: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { event: { findMany: m.events }, rSVP: { findMany: m.rsvps }, user: { findUnique: m.user } },
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "host", email: "host@example.test", role: "HOST" }),
}));
import { getDashboardEvents, getDashboardInvites } from "@/app/actions/event/dashboard";
const event = {
  id: "event",
  slug: "party",
  title: "Party",
  hostId: "host",
  startAt: new Date("2030-01-02T00:09:00Z"),
  timezone: "Asia/Seoul",
  status: "PUBLISHED",
  rsvps: [],
  coHosts: [],
  _count: { comments: 0 },
};
beforeEach(() => vi.clearAllMocks());
describe("#853 dashboard zone projections", () => {
  it("retains the stored zone on hosted/co-hosted cards", async () => {
    m.events.mockResolvedValue([event]);
    expect(await getDashboardEvents()).toEqual([
      expect.objectContaining({ timezone: "Asia/Seoul" }),
    ]);
  });
  it("retains the stored zone on invitation cards", async () => {
    m.user.mockResolvedValue({ id: "host", email: "host@example.test", phone: null });
    m.rsvps.mockResolvedValue([{ status: "GOING", editToken: "token", event }]);
    expect(await getDashboardInvites()).toEqual([
      expect.objectContaining({ timezone: "Asia/Seoul" }),
    ]);
  });
});

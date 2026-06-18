import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist all mock functions so vi.mock factories can reference them ──────────

const { mockEventFindMany, mockActivityFindMany, mockGetSession } = vi.hoisted(() => ({
  mockEventFindMany: vi.fn(),
  mockActivityFindMany: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findMany: mockEventFindMany },
    activityEvent: { findMany: mockActivityFindMany },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendBlastEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
  sendSmsBlast: vi.fn().mockResolvedValue(2),
}));

import { getDashboardEvents, getDashboardActivity } from "@/app/actions/event";

const USER_ID = "user-1";
const OTHER_HOST_ID = "host-2";

function asUser() {
  mockGetSession.mockResolvedValue({ userId: USER_ID, email: "user@example.com" });
}

function makeEvent(overrides: Partial<{
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  status: string;
  hostId: string;
  rsvps: { status: string; approved: boolean }[];
  coHosts: { userId: string }[];
  theme: { accentColor: string } | null;
}> = {}) {
  return {
    id: "e1",
    slug: "test-event",
    title: "Test Event",
    startAt: new Date("2026-08-01T18:00:00Z"),
    status: "PUBLISHED",
    hostId: USER_ID,
    rsvps: [],
    coHosts: [],
    theme: null,
    ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

// ── getDashboardEvents ─────────────────────────────────────────────────────────

describe("getDashboardEvents", () => {
  it("returns empty array when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await getDashboardEvents();
    expect(result).toEqual([]);
    expect(mockEventFindMany).not.toHaveBeenCalled();
  });

  it("queries events by hostId OR cohost membership", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([]);
    await getDashboardEvents();
    expect(mockEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { hostId: USER_ID },
          { coHosts: { some: { userId: USER_ID } } },
        ],
      },
    }));
  });

  it("orders events by startAt descending", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([]);
    await getDashboardEvents();
    expect(mockEventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { startAt: "desc" },
    }));
  });

  it("returns empty array when user has no events", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([]);
    const result = await getDashboardEvents();
    expect(result).toEqual([]);
  });

  it("computes going count from approved GOING rsvps", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({
      rsvps: [
        { status: "GOING", approved: true },
        { status: "GOING", approved: true },
        { status: "MAYBE", approved: true },
      ],
    })]);
    const [event] = await getDashboardEvents();
    expect(event.going).toBe(2);
  });

  it("computes maybe count from approved MAYBE rsvps", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({
      rsvps: [
        { status: "MAYBE", approved: true },
        { status: "MAYBE", approved: true },
        { status: "GOING", approved: true },
      ],
    })]);
    const [event] = await getDashboardEvents();
    expect(event.maybe).toBe(2);
  });

  it("computes pending count from unapproved rsvps regardless of status", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({
      rsvps: [
        { status: "GOING", approved: false },
        { status: "MAYBE", approved: false },
        { status: "GOING", approved: true },
      ],
    })]);
    const [event] = await getDashboardEvents();
    expect(event.pending).toBe(2);
  });

  it("marks event as isCohost=false when user is the host", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({ hostId: USER_ID })]);
    const [event] = await getDashboardEvents();
    expect(event.isCohost).toBe(false);
  });

  it("marks event as isCohost=true when user is a co-host", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({
      hostId: OTHER_HOST_ID,
      coHosts: [{ userId: USER_ID }],
    })]);
    const [event] = await getDashboardEvents();
    expect(event.isCohost).toBe(true);
  });

  it("passes through theme and basic event fields", async () => {
    asUser();
    const startAt = new Date("2026-12-25T20:00:00Z");
    mockEventFindMany.mockResolvedValue([makeEvent({
      id: "ev-42",
      slug: "xmas-party",
      title: "Xmas Party",
      startAt,
      status: "PUBLISHED",
      theme: { accentColor: "#ff0000" },
    })]);
    const [event] = await getDashboardEvents();
    expect(event.id).toBe("ev-42");
    expect(event.slug).toBe("xmas-party");
    expect(event.title).toBe("Xmas Party");
    expect(event.startAt).toBe(startAt);
    expect(event.status).toBe("PUBLISHED");
    expect(event.theme).toEqual({ accentColor: "#ff0000" });
  });

  it("handles event with null theme", async () => {
    asUser();
    mockEventFindMany.mockResolvedValue([makeEvent({ theme: null })]);
    const [event] = await getDashboardEvents();
    expect(event.theme).toBeNull();
  });

  it("returns multiple events preserving order from query", async () => {
    asUser();
    const d1 = new Date("2026-09-01");
    const d2 = new Date("2026-08-01");
    mockEventFindMany.mockResolvedValue([
      makeEvent({ id: "e1", slug: "e1", startAt: d1 }),
      makeEvent({ id: "e2", slug: "e2", startAt: d2 }),
    ]);
    const result = await getDashboardEvents();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("e1");
    expect(result[1].id).toBe("e2");
  });
});

// ── getDashboardActivity ───────────────────────────────────────────────────────

describe("getDashboardActivity", () => {
  it("returns empty array when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await getDashboardActivity(["e1"]);
    expect(result).toEqual([]);
    expect(mockActivityFindMany).not.toHaveBeenCalled();
  });

  it("returns empty array when eventIds list is empty", async () => {
    asUser();
    const result = await getDashboardActivity([]);
    expect(result).toEqual([]);
    expect(mockActivityFindMany).not.toHaveBeenCalled();
  });

  it("queries activityEvents by eventIds and orders them", async () => {
    asUser();
    mockActivityFindMany.mockResolvedValue([]);
    await getDashboardActivity(["e1", "e2"]);
    expect(mockActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        eventId: { in: ["e1", "e2"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        event: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    }));
  });
});

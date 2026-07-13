// Regression test: host "New RSVP" alert notifications were never wired up.
//
// Found: 2026-07 email-template rebuild (fixed in [de9262], 2026-07-12).
// Root cause: `sendHostRsvpAlertEmail` (lib/email.ts) and `sendHostRsvpAlertSms`
// (lib/sms.ts) shipped with styled, previewable templates, but no call site —
// `addRSVP` only sent the guest-facing confirmation, so hosts never received a
// "New RSVP" alert even though the docs advertised the feature. The per-event
// `hostAlertEmail`/`hostAlertSms` Event columns had also been dropped as schema
// drift (migration 20260705102712) because nothing in schema.prisma declared
// them.
//
// The fix re-adds the two toggle columns (email defaults ON, SMS defaults OFF)
// and fans the alert out to the host and all co-hosts after the RSVP write,
// fire-and-forget so a notification failure never blocks the guest's RSVP.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique, mockRsvpCreate, mockRsvpGroupBy, mockAlertEmail, mockAlertSms } =
  vi.hoisted(() => ({
    mockEventFindUnique: vi.fn(),
    mockRsvpCreate: vi.fn(),
    mockRsvpGroupBy: vi.fn(),
    mockAlertEmail: vi.fn().mockResolvedValue(undefined),
    mockAlertSms: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVP: {
      create: mockRsvpCreate,
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: mockRsvpGroupBy,
    },
    user: { upsert: vi.fn().mockResolvedValue({ id: "guest-user-1" }) },
    rSVPAnswer: { createMany: vi.fn() },
    plusOneGuest: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendApprovalEmail: vi.fn().mockResolvedValue(undefined),
  sendHostRsvpAlertEmail: mockAlertEmail,
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
  sendApprovalSms: vi.fn().mockResolvedValue(undefined),
  sendHostRsvpAlertSms: mockAlertSms,
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: vi.fn((_eventId: string, fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, limit: 15, remaining: 14 }),
}));

import { addRSVP } from "@/app/actions/event";

const EVENT_ID = "event-1";
const THEME = {
  baseTheme: "DARK",
  gradientFrom: "#7c3aed",
  gradientTo: "#1e40af",
  accentColor: "#a855f7",
};

function eventRow(overrides = {}) {
  return {
    id: EVENT_ID,
    slug: "test-event",
    title: "Test Party",
    approvalRequired: false,
    rsvpDeadline: null,
    capacity: null,
    startAt: new Date("2026-12-01T20:00:00Z"),
    endAt: null,
    timezone: "America/New_York",
    locationType: "PHYSICAL",
    locationName: "My House",
    locationAddress: null,
    virtualUrl: null,
    theme: THEME,
    hostAlertEmail: true,
    hostAlertSms: false,
    host: { name: "Joe", email: "host@example.com", phone: "+15551230000" },
    coHosts: [{ user: { email: "cohost@example.com", phone: null } }],
    rsvpFields: [],
    ...overrides,
  };
}

const RSVP_INPUT = {
  eventId: EVENT_ID,
  guestName: "Alice",
  status: "GOING" as const,
  plusOneCount: 1,
  note: "So excited!",
};

// The alert fan-out is detached from the action's own promise chain, so give
// the fire-and-forget block a chance to run before asserting non-delivery.
async function flushAsync() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAlertEmail.mockResolvedValue(undefined);
  mockAlertSms.mockResolvedValue(undefined);
  mockRsvpCreate.mockResolvedValue({ id: "rsvp-1", editToken: "tok-1" });
  mockRsvpGroupBy.mockResolvedValue([
    { status: "GOING", _count: { _all: 3 } },
    { status: "MAYBE", _count: { _all: 1 } },
  ]);
});

describe("host new-RSVP alert wiring in addRSVP", () => {
  it("emails the host and every co-host when hostAlertEmail is on", async () => {
    mockEventFindUnique.mockResolvedValue(eventRow());

    const result = await addRSVP(RSVP_INPUT);
    expect(result.success).toBe(true);

    await vi.waitFor(() => expect(mockAlertEmail).toHaveBeenCalledTimes(2));
    expect(mockAlertEmail).toHaveBeenCalledWith("host@example.com", {
      guestName: "Alice",
      status: "GOING",
      plusOneCount: 1,
      note: "So excited!",
      eventTitle: "Test Party",
      eventSlug: "test-event",
      goingCount: 3,
      maybeCount: 1,
      noCount: 0,
      theme: THEME,
    });
    expect(mockAlertEmail).toHaveBeenCalledWith(
      "cohost@example.com",
      expect.objectContaining({ guestName: "Alice", status: "GOING" })
    );
    expect(mockAlertSms).not.toHaveBeenCalled();
  });

  it("texts recipients with a phone number when hostAlertSms is on", async () => {
    mockEventFindUnique.mockResolvedValue(eventRow({ hostAlertEmail: false, hostAlertSms: true }));

    const result = await addRSVP(RSVP_INPUT);
    expect(result.success).toBe(true);

    // Only the host has a phone; the co-host must be skipped, not crash the send.
    await vi.waitFor(() => expect(mockAlertSms).toHaveBeenCalledTimes(1));
    expect(mockAlertSms).toHaveBeenCalledWith("+15551230000", {
      guestName: "Alice",
      status: "GOING",
      plusOneCount: 1,
      note: "So excited!",
      eventTitle: "Test Party",
      eventSlug: "test-event",
    });
    expect(mockAlertEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when both per-event toggles are off", async () => {
    mockEventFindUnique.mockResolvedValue(eventRow({ hostAlertEmail: false, hostAlertSms: false }));

    const result = await addRSVP(RSVP_INPUT);
    expect(result.success).toBe(true);

    await flushAsync();
    expect(mockAlertEmail).not.toHaveBeenCalled();
    expect(mockAlertSms).not.toHaveBeenCalled();
    expect(mockRsvpGroupBy).not.toHaveBeenCalled();
  });

  it("skips recipients without an email address instead of sending to nothing", async () => {
    mockEventFindUnique.mockResolvedValue(
      eventRow({ host: { name: "Joe", email: null, phone: null } })
    );

    const result = await addRSVP(RSVP_INPUT);
    expect(result.success).toBe(true);

    await vi.waitFor(() => expect(mockAlertEmail).toHaveBeenCalledTimes(1));
    expect(mockAlertEmail).toHaveBeenCalledWith("cohost@example.com", expect.anything());
  });

  it("never blocks or fails the guest's RSVP when the alert send rejects", async () => {
    mockEventFindUnique.mockResolvedValue(eventRow());
    mockAlertEmail.mockRejectedValue(new Error("SMTP down"));

    const result = await addRSVP(RSVP_INPUT);
    expect(result.success).toBe(true);
    expect((result as { id?: string }).id).toBe("rsvp-1");
    await flushAsync();
  });
});

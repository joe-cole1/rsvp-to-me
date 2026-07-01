// SEC-23 — Unauthenticated addRSVP fan-out with no rate limit.
//
// Bug (found 2026-07, security review): `addRSVP` in app/actions/event.ts is
// callable by anyone on PUBLIC/UNLISTED events. It upserts a User from the
// attacker-supplied guestEmail/guestPhone and fires a confirmation email/SMS to
// that address, with NO rate limiting (unlike verifyEventPassword / guest
// invite). That is an email/SMS bomb + Twilio-cost vector and lets an attacker
// pre-create arbitrary User rows.
//
// Fix: throttle by IP and per-event+IP with the shared rateLimit()/getClientIp()
// helpers BEFORE any DB lookup, User upsert, or send.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRateLimit, mockGetClientIp, mockEventFindUnique, mockConfirmationEmail } = vi.hoisted(
  () => ({
    mockRateLimit: vi.fn(),
    mockGetClientIp: vi.fn(),
    mockEventFindUnique: vi.fn(),
    mockConfirmationEmail: vi.fn(),
  })
);

vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: mockGetClientIp }));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { upsert: vi.fn() },
    rSVP: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: mockConfirmationEmail,
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: vi.fn(),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: vi.fn(),
}));

import { addRSVP } from "@/app/actions/event";

const validInput = {
  eventId: "evt-1",
  guestName: "Attacker",
  guestEmail: "victim@example.com",
  status: "GOING" as const,
  plusOneCount: 0,
};

describe("SEC-23: addRSVP rate limiting", () => {
  beforeEach(() => {
    mockRateLimit.mockReset();
    mockGetClientIp.mockReset();
    mockEventFindUnique.mockReset();
    mockConfirmationEmail.mockReset();
    mockGetClientIp.mockResolvedValue("203.0.113.7");
  });

  it("blocks once the IP limit is exceeded, without touching the DB or sending", async () => {
    mockRateLimit.mockResolvedValue({ success: false, limit: 15, remaining: 0, reset: new Date() });

    const result = await addRSVP(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many rsvps/i);
    // Must short-circuit before any DB lookup / User upsert / confirmation send.
    expect(mockEventFindUnique).not.toHaveBeenCalled();
    expect(mockConfirmationEmail).not.toHaveBeenCalled();
    // First limiter is keyed per IP.
    expect(mockRateLimit).toHaveBeenCalledWith("rsvp:ip:203.0.113.7", 15, 600);
  });

  it("enforces a per-event+IP cap after the IP check passes", async () => {
    mockRateLimit
      .mockResolvedValueOnce({ success: true, limit: 15, remaining: 14, reset: new Date() })
      .mockResolvedValueOnce({ success: false, limit: 8, remaining: 0, reset: new Date() });

    const result = await addRSVP(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many rsvps for this event/i);
    expect(mockEventFindUnique).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenNthCalledWith(2, "rsvp:evt:evt-1:203.0.113.7", 8, 600);
  });

  it("proceeds to the event lookup when under the limit", async () => {
    mockRateLimit.mockResolvedValue({ success: true, limit: 15, remaining: 14, reset: new Date() });
    mockEventFindUnique.mockResolvedValue(null); // → "Event not found", but the DB was reached

    const result = await addRSVP(validInput);

    expect(mockEventFindUnique).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event not found/i);
  });
});

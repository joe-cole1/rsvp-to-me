// SEC-12 — Race condition in RSVP capacity check.
//
// Bug (found 2026-06, security review): `addRSVP` in app/actions/event.ts
// enforced capacity with a non-atomic check-then-act pattern — `rSVP.count()`
// (check) and `rSVP.create()` (act) ran as two separate queries with nothing
// serializing them. Two simultaneous GOING submissions could both pass the
// count check before either row was written, overbooking the event.
//
// Fix: the capacity re-count and the RSVP write now run inside a per-event lock
// (`withEventCapacityLock`), so the count immediately precedes the write within
// the same critical section.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEventFindUnique, mockRsvpCount, mockRsvpCreate, mockRsvpFindFirst, mockWithLock } =
  vi.hoisted(() => ({
    mockEventFindUnique: vi.fn(),
    mockRsvpCount: vi.fn(),
    mockRsvpCreate: vi.fn(),
    mockRsvpFindFirst: vi.fn(),
    mockWithLock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVP: { count: mockRsvpCount, create: mockRsvpCreate, findFirst: mockRsvpFindFirst },
  },
}));
// Run the locked callback inline, but record that the write was wrapped in it.
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: mockWithLock,
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(null),
  iconLabel: vi.fn(),
}));
vi.mock("@/lib/utils", () => ({ tzLocalToUtc: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ getUnlockSignature: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
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

const EVENT = {
  id: "evt-1",
  slug: "party",
  title: "Party",
  approvalRequired: false,
  rsvpDeadline: null,
  capacity: 2,
  startAt: new Date(),
  locationName: null,
  host: { name: "Host", email: "host@example.com" },
};

describe("SEC-12: atomic RSVP capacity enforcement", () => {
  beforeEach(() => {
    mockEventFindUnique.mockReset();
    mockRsvpCount.mockReset();
    mockRsvpCreate.mockReset();
    mockRsvpFindFirst.mockReset();
    mockWithLock.mockReset();
    // Default: run the protected callback inline so the real logic executes.
    mockWithLock.mockImplementation((_eventId: string, fn: () => Promise<unknown>) => fn());
    mockEventFindUnique.mockResolvedValue(EVENT);
    mockRsvpFindFirst.mockResolvedValue(null);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-1", editToken: "tok-1" });
  });

  it("re-counts and writes inside the per-event lock", async () => {
    mockRsvpCount.mockResolvedValue(0);

    const result = await addRSVP({ eventId: "evt-1", guestName: "Ada", status: "GOING" });

    expect(result.success).toBe(true);
    // The write must be wrapped by the lock helper, keyed to the event.
    expect(mockWithLock).toHaveBeenCalledWith("evt-1", expect.any(Function));
    // Both the count and the create happened (inside that locked callback).
    expect(mockRsvpCount).toHaveBeenCalledOnce();
    expect(mockRsvpCreate).toHaveBeenCalledOnce();
  });

  it("rejects when capacity is already reached, without writing", async () => {
    mockRsvpCount.mockResolvedValue(2); // capacity === 2

    const result = await addRSVP({ eventId: "evt-1", guestName: "Ada", status: "GOING" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at capacity/i);
    expect(mockRsvpCreate).not.toHaveBeenCalled();
  });
});

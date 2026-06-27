// SEC-21(b) — `updateRSVP` skipped deadline/capacity re-check.
//
// Bug (found 2026-06, security review): `updateRSVP` in app/actions/event.ts
// updated an RSVP purely on a valid `editToken`, never re-validating the event
// deadline or capacity. A token-holding guest could flip their status to GOING
// after `rsvpDeadline` had passed, or past `capacity` — a capacity-bypass cousin
// of SEC-12.
//
// Fix: re-check the deadline (declining is still always allowed) and enforce
// capacity under the same per-event lock as `addRSVP`, but only when the RSVP is
// actually transitioning *into* a GOING seat.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRsvpFindUnique, mockRsvpCount, mockRsvpUpdate, mockWithLock } = vi.hoisted(() => ({
  mockRsvpFindUnique: vi.fn(),
  mockRsvpCount: vi.fn(),
  mockRsvpUpdate: vi.fn(),
  mockWithLock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rSVP: {
      findUnique: mockRsvpFindUnique,
      count: mockRsvpCount,
      update: mockRsvpUpdate,
    },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
    rSVPAnswer: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/capacityLock", () => ({ withEventCapacityLock: mockWithLock }));
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

import { updateRSVP } from "@/app/actions/event";

const PAST = new Date(Date.now() - 60_000);

function rsvpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rsvp-1",
    eventId: "evt-1",
    editToken: "tok-1",
    guestName: "Ada",
    status: "MAYBE",
    approved: true,
    event: { slug: "party", capacity: 2, rsvpDeadline: null },
    ...overrides,
  };
}

describe("SEC-21(b): updateRSVP re-checks deadline and capacity", () => {
  beforeEach(() => {
    mockRsvpFindUnique.mockReset();
    mockRsvpCount.mockReset();
    mockRsvpUpdate.mockReset();
    mockWithLock.mockReset();
    mockWithLock.mockImplementation((_eventId: string, fn: () => Promise<unknown>) => fn());
    mockRsvpUpdate.mockResolvedValue({ id: "rsvp-1" });
  });

  it("blocks flipping to GOING after the deadline, without writing", async () => {
    mockRsvpFindUnique.mockResolvedValue(
      rsvpRow({ status: "MAYBE", event: { slug: "party", capacity: null, rsvpDeadline: PAST } })
    );

    const result = await updateRSVP("tok-1", { status: "GOING", plusOneCount: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/deadline/i);
    expect(mockRsvpUpdate).not.toHaveBeenCalled();
  });

  it("still allows declining (NO) after the deadline", async () => {
    mockRsvpFindUnique.mockResolvedValue(
      rsvpRow({ status: "GOING", event: { slug: "party", capacity: null, rsvpDeadline: PAST } })
    );

    const result = await updateRSVP("tok-1", { status: "NO", plusOneCount: 0 });

    expect(result.success).toBe(true);
    expect(mockRsvpUpdate).toHaveBeenCalledOnce();
  });

  it("blocks transitioning to GOING past capacity, without writing", async () => {
    mockRsvpFindUnique.mockResolvedValue(rsvpRow({ status: "MAYBE" }));
    mockRsvpCount.mockResolvedValue(2); // capacity === 2, full

    const result = await updateRSVP("tok-1", { status: "GOING", plusOneCount: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at capacity/i);
    expect(mockWithLock).toHaveBeenCalledWith("evt-1", expect.any(Function));
    expect(mockRsvpUpdate).not.toHaveBeenCalled();
  });

  it("does not block a note edit on an already-GOING RSVP at a full event", async () => {
    mockRsvpFindUnique.mockResolvedValue(rsvpRow({ status: "GOING" }));
    mockRsvpCount.mockResolvedValue(2); // full, but this RSVP already holds a seat

    const result = await updateRSVP("tok-1", {
      status: "GOING",
      plusOneCount: 0,
      note: "running late",
    });

    expect(result.success).toBe(true);
    // No new seat consumed → capacity is never even counted.
    expect(mockRsvpCount).not.toHaveBeenCalled();
    expect(mockRsvpUpdate).toHaveBeenCalledOnce();
  });
});

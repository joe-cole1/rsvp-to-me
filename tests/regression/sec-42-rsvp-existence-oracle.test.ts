// SEC-42 — existence oracle on host RSVP actions.
//
// Bug (found 2026-07, [cd6748] OWASP audit): deleteRsvpAsHost / approveRsvp /
// declineRsvp threw "Not found" *before* the assertHostOrCohost authorization
// check, letting any caller distinguish existing from non-existing RSVP ids
// (and probe them without a session at all).
//
// Fix: a session is required before any lookup ("Unauthorized"), and a missing
// id throws the same "Forbidden" as an unauthorized one, so responses no
// longer reveal whether an RSVP id exists.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockRsvpFindUnique, mockEventFindUnique } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRsvpFindUnique: vi.fn(),
  mockEventFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rSVP: { findUnique: mockRsvpFindUnique, update: vi.fn(), delete: vi.fn() },
    event: { findUnique: mockEventFindUnique },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(null),
  iconLabel: vi.fn(),
}));
vi.mock("@/lib/capacityLock", () => ({ withEventCapacityLock: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ getUnlockSignature: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendApprovalSms: vi.fn(),
}));

import { deleteRsvpAsHost, approveRsvp, declineRsvp } from "@/app/actions/event/rsvp";

const EXISTING_RSVP = {
  id: "rsvp-1",
  eventId: "evt-1",
  guestName: "Alice",
  guestEmail: null,
  guestPhone: null,
  event: { id: "evt-1", slug: "party", title: "Party", host: { email: null } },
};

// Event owned by someone else than the caller — authorization must fail.
const FOREIGN_EVENT = { id: "evt-1", hostId: "owner-1", slug: "party", coHosts: [] };

const actions = [
  ["deleteRsvpAsHost", deleteRsvpAsHost],
  ["approveRsvp", approveRsvp],
  ["declineRsvp", declineRsvp],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(actions)("SEC-42: %s", (_name, action) => {
  it("throws Unauthorized without a session, before any RSVP lookup", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(action("rsvp-anything")).rejects.toThrow("Unauthorized");
    expect(mockRsvpFindUnique).not.toHaveBeenCalled();
  });

  it("throws the same Forbidden for a missing id as for an unauthorized one", async () => {
    mockGetSession.mockResolvedValue({ userId: "attacker-1", role: "HOST" });
    mockEventFindUnique.mockResolvedValue(FOREIGN_EVENT);

    // Existing RSVP, caller not the host → Forbidden (from assertHostOrCohost)
    mockRsvpFindUnique.mockResolvedValue(EXISTING_RSVP);
    await expect(action("rsvp-1")).rejects.toThrow("Forbidden");

    // Missing RSVP → identical Forbidden, not "Not found"
    mockRsvpFindUnique.mockResolvedValue(null);
    await expect(action("rsvp-missing")).rejects.toThrow("Forbidden");
  });
});

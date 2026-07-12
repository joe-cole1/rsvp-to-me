// SEC-36 — Host/co-host invite issuance was not attributed in the activity log.
//
// Bug (found 2026-07, STRIDE threat model of the auth/invite flows —
// Repudiation): inviteGuest fanned out email/SMS invites but, unlike the
// guest-facing inviteFriendAsGuest (which calls logActivity), wrote no
// ActivityEvent. Invites sent via the host/co-host path were therefore
// unattributable — a co-host driving spam invites left no audit trail.
//
// Fix: log a "guest_invite" ActivityEvent on successful issuance, attributed to
// the acting host, fire-and-forget with logSafe (matching addRSVP).

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSession,
  mockEventFindUnique,
  mockRateLimit,
  mockGetClientIp,
  mockUserFindFirst,
  mockUserCreate,
  mockRsvpFindFirst,
  mockRsvpCreate,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockActivityCreate,
  mockInviteEmail,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockRsvpCreate: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockActivityCreate: vi.fn(),
  mockInviteEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    rSVP: { findFirst: mockRsvpFindFirst, create: mockRsvpCreate },
    invitation: { findFirst: mockInvitationFindFirst, create: mockInvitationCreate },
    activityEvent: { create: mockActivityCreate },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: mockGetClientIp }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: mockInviteEmail,
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: vi.fn(),
}));

import { inviteGuest } from "@/app/actions/event";

const EVENT_ID = "evt-1";

describe("SEC-36: inviteGuest writes an attributed activity-log entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "host-1", email: "alice@x.com", role: "HOST" });
    mockEventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      hostId: "host-1",
      slug: "party",
      coHosts: [],
      title: "Party",
      startAt: new Date(),
    });
    mockGetClientIp.mockResolvedValue("1.2.3.4");
    mockRateLimit.mockResolvedValue({ success: true, limit: 15, remaining: 14, reset: new Date() });
    mockUserFindFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "user-new" });
    mockRsvpFindFirst.mockResolvedValue(null);
    mockRsvpCreate.mockResolvedValue({ id: "rsvp-new", editToken: "tok", guestName: "newguest" });
    mockInvitationFindFirst.mockResolvedValue(null);
    mockActivityCreate.mockResolvedValue({});
  });

  it("logs a guest_invite ActivityEvent attributed to the acting host on success", async () => {
    const result = await inviteGuest(EVENT_ID, "newguest@example.com");

    expect(result.success).toBe(true);
    expect(mockActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockActivityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: EVENT_ID,
        type: "guest_invite",
        // Attributed to the host (email local-part), not left anonymous.
        actorName: "alice",
        detail: expect.stringContaining("alice"),
      }),
    });
  });

  it("does not log anything when the invite batch fails entirely", async () => {
    // A single invalid entry produces zero successful sends → the action throws
    // and no activity is recorded.
    await expect(inviteGuest(EVENT_ID, "not-an-email")).rejects.toThrow(/Failed to send invites/);
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });
});

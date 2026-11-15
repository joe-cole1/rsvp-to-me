import "@/tests/helpers/english-request-locale";
// SEC-46 — Host/co-host invite issuance was not attributed in the activity log.
//
// Bug (found 2026-07, STRIDE threat model of the auth/invite flows —
// Repudiation): inviteGuest fanned out email/SMS invites but, unlike the
// guest-facing inviteFriendAsGuest (which calls logActivity), wrote no
// ActivityEvent. Invites sent via the host/co-host path were therefore
// unattributable — a co-host driving spam invites left no audit trail.
//
// Fix: log a "guest_invite" ActivityEvent on successful issuance, attributed to
// the acting host, fire-and-forget with logSafe (matching addRSVP).
//
// 8be23944 retired inviteGuest. Attribution now applies to sendGuestInvitations,
// the only host send path, so the cases below target it.

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
    async $transaction(action: (client: unknown) => Promise<unknown>) {
      return action(this);
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    event: { findUnique: mockEventFindUnique },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    rSVP: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: mockRsvpFindFirst,
      create: mockRsvpCreate,
    },
    invitation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: mockInvitationFindFirst,
      create: mockInvitationCreate,
    },
    activityEvent: { create: mockActivityCreate },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({
  isTrustedIpConfigured: () => true,
  getClientIp: mockGetClientIp,
}));
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
vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  getChannelConfig: vi.fn().mockResolvedValue({ email: true, sms: true }),
}));

import { sendGuestInvitations } from "@/app/actions/event";

const EVENT_ID = "evt-1";
const reviewed = (expectedDisposition: "new" | "invited") => ({
  contact: "newguest@example.com",
  expectedDisposition,
  expectedGuestName: "Guest",
});

describe("SEC-46: host invitations write an attributed activity-log entry", () => {
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
    const result = await sendGuestInvitations(EVENT_ID, [reviewed("new")]);

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
    // A stale review produces zero successful sends → nothing is delivered and no
    // activity is recorded.
    const result = await sendGuestInvitations(EVENT_ID, [reviewed("invited")]);

    expect(result.success).toBe(false);
    expect(mockInviteEmail).not.toHaveBeenCalled();
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });

  it("does not log anything when the batch is rejected as malformed", async () => {
    await expect(
      sendGuestInvitations(EVENT_ID, [{ ...reviewed("new"), contact: "not-an-email" }])
    ).rejects.toThrow(/review the invitation names and contacts/i);
    expect(mockActivityCreate).not.toHaveBeenCalled();
  });
});

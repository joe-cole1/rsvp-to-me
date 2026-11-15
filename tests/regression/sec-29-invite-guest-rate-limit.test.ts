import "@/tests/helpers/english-request-locale";
// SEC-29 — Host inviteGuest fan-out had no batch cap or rate limit.
//
// Bug (found 2026-07, security review): inviteGuest in app/actions/event.ts
// splits a comma-separated list and sends an email/SMS per entry with no bound
// on the list size and no rateLimit() (unlike the guest-facing
// inviteFriendAsGuest, SEC-18). An abusive or hijacked host session could drive
// large spam blasts and unbounded Twilio cost.
//
// Fix: cap the batch size and throttle per host+event and per IP before the
// send loop, mirroring inviteFriendAsGuest / verifyEventPassword.
//
// 8be23944 retired inviteGuest. These guards now protect sendGuestInvitations,
// the only host send path, so the cases below target it.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockEventFindUnique, mockRateLimit, mockGetClientIp, mockInviteEmail } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockEventFindUnique: vi.fn(),
    mockRateLimit: vi.fn(),
    mockGetClientIp: vi.fn(),
    mockInviteEmail: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    async $transaction(action: (client: unknown) => Promise<unknown>) {
      return action(this);
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    event: { findUnique: mockEventFindUnique },
    user: { findFirst: vi.fn(), create: vi.fn() },
    rSVP: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn() },
    invitation: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn() },
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

import { sendGuestInvitations } from "@/app/actions/event";
import { MAX_INVITATION_RECIPIENTS } from "@/lib/invitation-draft";

const EVENT_ID = "evt-1";
const reviewed = (contact: string) => ({
  contact,
  expectedDisposition: "new" as const,
  expectedGuestName: "Guest",
});

describe("SEC-29: host invitation batch cap + rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "host-1", email: "h@x.com", role: "HOST" });
    mockEventFindUnique.mockResolvedValue({ hostId: "host-1", slug: "party", coHosts: [] });
    mockGetClientIp.mockResolvedValue("1.2.3.4");
    mockRateLimit.mockResolvedValue({ success: true, limit: 15, remaining: 14, reset: new Date() });
  });

  it("rejects a batch larger than the cap before any rate-limit check or send", async () => {
    expect(MAX_INVITATION_RECIPIENTS).toBe(200);
    const huge = Array.from({ length: 201 }, (_, i) => reviewed(`g${i}@x.com`));

    await expect(sendGuestInvitations(EVENT_ID, huge)).rejects.toThrow(
      /review the invitation names and contacts/i
    );
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockInviteEmail).not.toHaveBeenCalled();
  });

  it("throws and sends nothing once the per-IP limit is exceeded", async () => {
    mockRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 15,
      remaining: 0,
      reset: new Date(),
    });

    await expect(sendGuestInvitations(EVENT_ID, [reviewed("a@x.com")])).rejects.toThrow(
      /too many invites sent/i
    );
    expect(mockInviteEmail).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenCalledWith("host-invite:ip:1.2.3.4", 15, 3600);
  });

  it("enforces a per-host+event cap after the IP check passes", async () => {
    mockRateLimit
      .mockResolvedValueOnce({ success: true, limit: 15, remaining: 14, reset: new Date() })
      .mockResolvedValueOnce({ success: false, limit: 10, remaining: 0, reset: new Date() });

    await expect(sendGuestInvitations(EVENT_ID, [reviewed("a@x.com")])).rejects.toThrow(
      /too many invites sent for this event/i
    );
    expect(mockInviteEmail).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenNthCalledWith(2, "host-invite:host-1:evt-1", 10, 3600);
  });
});

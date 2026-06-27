// SEC-18 — Uncapped outbound email/SMS via guest invite.
//
// Bug (found 2026-06, security review): `inviteFriendAsGuest` in
// app/actions/event.ts is authorized solely by a guest `editToken` and fans
// out to SMTP/Twilio, but had no rate limit or per-RSVP cap. On a private
// event with `guestsCanInvite`, a guest holding a valid token could drive
// unlimited emails/SMS to arbitrary recipients — spam/phishing under the
// platform's sending reputation plus real Twilio cost. The caller controls
// both the recipient and the `hostName` shown.
//
// Fix: reuse the shared `rateLimit()` + `getClientIp()` helpers (same pattern
// as `verifyEventPassword`/auth) to gate the action by IP (burst, checked
// before any DB lookup), by token (burst), and by inviting RSVP (daily cap).
// When a limit is exceeded the action must short-circuit BEFORE creating any
// user/RSVP/invitation rows or sending email/SMS.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRateLimit,
  mockGetClientIp,
  mockRsvpFindUnique,
  mockRsvpFindFirst,
  mockRsvpCreate,
  mockUserFindFirst,
  mockUserCreate,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockSendEventInviteEmail,
  mockSendEventInviteSms,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockRsvpFindUnique: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockRsvpCreate: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockSendEventInviteEmail: vi.fn(),
  mockSendEventInviteSms: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: mockGetClientIp }));
vi.mock("@/lib/db", () => ({
  db: {
    rSVP: {
      findUnique: mockRsvpFindUnique,
      findFirst: mockRsvpFindFirst,
      create: mockRsvpCreate,
    },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    invitation: { findFirst: mockInvitationFindFirst, create: mockInvitationCreate },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  iconLabel: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: mockSendEventInviteEmail,
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: mockSendEventInviteSms,
}));

import { inviteFriendAsGuest } from "@/app/actions/event";

const ALLOW = { success: true, limit: 30, remaining: 29, reset: new Date() };
const DENY = { success: false, limit: 30, remaining: 0, reset: new Date() };

// A valid, authorized inviting RSVP: attending guest on a private event that
// allows guest invites.
const validInvitingRsvp = {
  id: "rsvp_inviter",
  eventId: "evt_1",
  guestName: "Mallory",
  guestEmail: "mallory@example.com",
  status: "GOING",
  editToken: "tok_abc",
  event: {
    id: "evt_1",
    slug: "secret-party",
    title: "Secret Party",
    visibility: "PRIVATE",
    guestsCanInvite: true,
    maybeEnabled: true,
    startAt: new Date(),
    locationName: "HQ",
  },
};

describe("SEC-18: guest-invite rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockResolvedValue("203.0.113.7");
  });

  it("blocks on the per-IP limit before any DB lookup or send", async () => {
    mockRateLimit.mockResolvedValueOnce(DENY); // ip limit denies first

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "victim@example.com");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many invites/i);
    // Short-circuits before touching the database.
    expect(mockRsvpFindUnique).not.toHaveBeenCalled();
    expect(mockSendEventInviteEmail).not.toHaveBeenCalled();
    // IP limit is keyed per client IP.
    expect(mockRateLimit).toHaveBeenCalledWith("guest-invite:ip:203.0.113.7", 30, 3600);
  });

  it("blocks on the per-token burst limit before creating rows or sending", async () => {
    mockRateLimit
      .mockResolvedValueOnce(ALLOW) // ip
      .mockResolvedValueOnce(DENY); // token burst denies
    mockRsvpFindUnique.mockResolvedValue(validInvitingRsvp);

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "victim@example.com");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many invites/i);
    // No user/RSVP/invitation created, nothing sent.
    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockSendEventInviteEmail).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenCalledWith("guest-invite:token:tok_abc", 10, 600);
  });

  it("blocks on the per-RSVP daily cap before creating rows or sending", async () => {
    mockRateLimit
      .mockResolvedValueOnce(ALLOW) // ip
      .mockResolvedValueOnce(ALLOW) // token burst
      .mockResolvedValueOnce(DENY); // rsvp daily cap denies
    mockRsvpFindUnique.mockResolvedValue(validInvitingRsvp);

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "victim@example.com");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum number of invites/i);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockSendEventInviteEmail).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenCalledWith("guest-invite:rsvp:rsvp_inviter", 20, 86400);
  });

  it("does not consume the token/RSVP cap when the token is invalid", async () => {
    mockRateLimit.mockResolvedValueOnce(ALLOW); // ip allows
    mockRsvpFindUnique.mockResolvedValue(null); // unknown token

    const result = await inviteFriendAsGuest("evt_1", "bad-token", "victim@example.com");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid guest token/i);
    // Only the IP limit was consumed — no token/RSVP cap calls.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSendEventInviteEmail).not.toHaveBeenCalled();
  });

  it("sends the invite when all limits are under threshold", async () => {
    mockRateLimit.mockResolvedValue(ALLOW); // ip + token + rsvp all allow
    mockRsvpFindUnique.mockResolvedValue(validInvitingRsvp);
    mockUserFindFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "user_new" });
    mockRsvpFindFirst.mockResolvedValue(null);
    mockRsvpCreate.mockResolvedValue({
      id: "rsvp_new",
      guestName: "victim",
      editToken: "tok_new",
    });
    mockInvitationFindFirst.mockResolvedValue(null);
    mockInvitationCreate.mockResolvedValue({ id: "inv_1" });

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "victim@example.com");

    expect(result.success).toBe(true);
    expect(mockSendEventInviteEmail).toHaveBeenCalledOnce();
  });
});

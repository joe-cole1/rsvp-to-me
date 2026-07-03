// L-4b — One missed L-4 site: swallowed error in `inviteFriendAsGuest`.
//
// Bug (found 2026-07 during the L-3 split of app/actions/event.ts): the L-4
// sweep (PR #221) funneled 25+ silent `.catch(() => {})` sites through the
// shared `logSafe` helper, but the `logActivity(...)` call in
// `inviteFriendAsGuest` (app/actions/event/invites.ts) was moved verbatim
// during the split and still swallowed activity-log failures with a bare
// `.catch(() => {})`, losing the diagnostic breadcrumb.
//
// Fix: route the rejection through `logSafe("inviteFriendAsGuest")`, matching
// every other non-critical `logActivity` call site.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRateLimit, mockLogActivity, mockLogSafe, mockLogSafeHandler } = vi.hoisted(() => {
  const mockLogSafeHandler = vi.fn().mockReturnValue(null);
  return {
    mockRateLimit: vi.fn(),
    mockLogActivity: vi.fn(),
    mockLogSafe: vi.fn().mockReturnValue(mockLogSafeHandler),
    mockLogSafeHandler,
  };
});

vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn().mockResolvedValue("203.0.113.7") }));
vi.mock("@/lib/logger", () => ({ logSafe: mockLogSafe, logger: {} }));
vi.mock("@/lib/activity", () => ({ logActivity: mockLogActivity, iconLabel: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    rSVP: {
      findUnique: vi.fn().mockResolvedValue({
        id: "rsvp_inviter",
        eventId: "evt_1",
        guestName: "Alice",
        guestEmail: "alice@example.com",
        status: "GOING",
        editToken: "tok_abc",
        event: {
          id: "evt_1",
          slug: "party",
          title: "Party",
          visibility: "PRIVATE",
          guestsCanInvite: true,
          maybeEnabled: true,
          startAt: new Date(),
          locationName: "HQ",
        },
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "rsvp_new",
        guestName: "bob",
        editToken: "tok_new",
      }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "user_new" }),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "inv_1" }),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: vi.fn(),
}));

import { inviteFriendAsGuest } from "@/app/actions/event";

const ALLOW = { success: true, limit: 30, remaining: 29, reset: new Date() };

describe("L-4b: inviteFriendAsGuest activity-log failures are logged, not swallowed", () => {
  beforeEach(() => {
    mockRateLimit.mockResolvedValue(ALLOW);
    mockLogActivity.mockReset();
    mockLogSafe.mockClear();
    mockLogSafeHandler.mockClear();
  });

  it("routes a logActivity rejection through logSafe('inviteFriendAsGuest')", async () => {
    const boom = new Error("activity log write failed");
    mockLogActivity.mockRejectedValue(boom);

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "bob@example.com");

    // The failure stays non-critical: the invite itself still succeeds.
    expect(result.success).toBe(true);

    // Flush the microtask queue so the .catch handler runs.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogSafe).toHaveBeenCalledWith("inviteFriendAsGuest");
    expect(mockLogSafeHandler).toHaveBeenCalledWith(boom);
  });

  it("does not invoke the logSafe handler when logActivity succeeds", async () => {
    mockLogActivity.mockResolvedValue(undefined);

    const result = await inviteFriendAsGuest("evt_1", "tok_abc", "bob@example.com");
    expect(result.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockLogSafeHandler).not.toHaveBeenCalled();
  });
});

// SEC-17 — Comment authZ bypass + identity spoofing for authenticated users.
//
// Bug (found 2026-06, security review): the SEC-3 fix only hardened the
// unauthenticated path of `addComment`. When a session existed, the action
// skipped every check and inserted the comment using the client-supplied
// `guestName`. Two consequences:
//   (a) AuthZ bypass — any logged-in user who knew an `eventId` could comment on
//       events they had no relationship to, including PRIVATE ones (the page.tsx
//       visibility gate is bypassed because the action enforced nothing).
//   (b) Identity spoofing — `guestName` was free-form, so a logged-in guest
//       could post under the host's or another attendee's name.
//
// Fix: when authenticated, derive the stored display name server-side (user
// record, or the matched approved RSVP) — never the client. A pending RSVP is
// blocked; a logged-in user with no RSVP may comment on PUBLIC/UNLISTED events
// (publicly viewable) but not on PRIVATE ones, closing the bypass.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSession,
  mockEventFindUnique,
  mockUserFindUnique,
  mockRsvpFindFirst,
  mockCommentFindFirst,
  mockCommentCreate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockCommentFindFirst: vi.fn(),
  mockCommentCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { findUnique: mockUserFindUnique },
    rSVP: { findFirst: mockRsvpFindFirst },
    comment: { findFirst: mockCommentFindFirst, create: mockCommentCreate },
    activityEvent: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
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

import { addComment } from "@/app/actions/event";

const EVENT_ID = "evt-private";

describe("SEC-17: comment authZ bypass + identity spoofing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventFindUnique.mockResolvedValue({
      slug: "secret-party",
      commentsEnabled: true,
      hostId: "host-user",
      visibility: "PRIVATE",
      coHosts: [],
    });
    mockCommentCreate.mockResolvedValue({ id: "comment-1" });
  });

  it("rejects a logged-in user with no relationship to a PRIVATE event (bypass)", async () => {
    // A logged-in stranger on a PRIVATE event: not host, not co-host, no RSVP.
    mockGetSession.mockResolvedValue({ userId: "stranger", email: "x@y.z", role: "GUEST" });
    mockRsvpFindFirst.mockResolvedValue(null);

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Anything",
      body: "I shouldn't be able to post here",
    });

    expect(result).toEqual({
      success: false,
      error: "You must be an approved guest to comment.",
    });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("rejects a logged-in guest whose RSVP is still pending (unapproved)", async () => {
    mockGetSession.mockResolvedValue({ userId: "pending-user", email: "p@y.z", role: "GUEST" });
    mockRsvpFindFirst.mockResolvedValue({
      id: "rsvp-p",
      guestName: "Pending Pat",
      approved: false,
    });

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Pending Pat",
      body: "Let me in early",
    });

    expect(result).toEqual({
      success: false,
      error: "You must be an approved guest to comment.",
    });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("lets a logged-in user with no RSVP comment on a PUBLIC event, using their record name", async () => {
    mockEventFindUnique.mockResolvedValue({
      slug: "open-party",
      commentsEnabled: true,
      hostId: "host-user",
      visibility: "PUBLIC",
      coHosts: [],
    });
    mockGetSession.mockResolvedValue({ userId: "viewer", email: "v@y.z", role: "GUEST" });
    mockRsvpFindFirst.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ name: "Vera Viewer", email: "v@y.z" });

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Someone Else", // spoof attempt
      body: "Public hello",
    });

    expect(result).toEqual({ success: true, id: "comment-1" });
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guestName: "Vera Viewer", rsvpId: null }),
      })
    );
  });

  it("stores the RSVP-derived name, not the client-supplied name (anti-spoofing)", async () => {
    // An approved guest tries to impersonate the host by passing a fake name.
    mockGetSession.mockResolvedValue({ userId: "guest-user", email: "g@y.z", role: "GUEST" });
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-9", guestName: "Real Guest", approved: true });

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "The Host", // spoofed
      body: "Hello from the 'host'",
    });

    expect(result).toEqual({ success: true, id: "comment-1" });
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guestName: "Real Guest", rsvpId: "rsvp-9" }),
      })
    );
    // The attacker-supplied name must never reach the database.
    const written = mockCommentCreate.mock.calls[0][0].data;
    expect(written.guestName).not.toBe("The Host");
  });
});

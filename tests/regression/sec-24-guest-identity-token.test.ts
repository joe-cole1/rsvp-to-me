// SEC-24 — Guest identity for comments/votes/potluck was spoofable.
//
// Bug (found 2026-07, security review): the unauthenticated branches of
// addComment, castVote, addPollOption, claimPotluckItem, and unclaimPotluckItem
// authorized a guest by looking up an approved RSVP via a client-supplied
// rsvpId and checking rsvp.guestName === suppliedName. But app/e/[slug]/page.tsx
// ships BOTH the id and guestName of every approved RSVP to every viewer, so the
// "identity" check compared two public values — anyone could act as any
// approved guest (residual of SEC-3/4/17).
//
// Fix: authorize with the SECRET per-RSVP editToken (which only the guest
// holds and is never in the public payload), and derive the stored name from
// that RSVP row — never the client-supplied name.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSession,
  mockEventFindUnique,
  mockRsvpFindFirst,
  mockCommentFindFirst,
  mockCommentCreate,
  mockPollFindUnique,
  mockPollOptionFindUnique,
  mockPollVoteDeleteMany,
  mockPollVoteUpsert,
  mockPotluckItemFindUnique,
  mockPotluckClaimCreate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockCommentFindFirst: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockPollFindUnique: vi.fn(),
  mockPollOptionFindUnique: vi.fn(),
  mockPollVoteDeleteMany: vi.fn(),
  mockPollVoteUpsert: vi.fn(),
  mockPotluckItemFindUnique: vi.fn(),
  mockPotluckClaimCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { findUnique: vi.fn() },
    rSVP: { findFirst: mockRsvpFindFirst },
    comment: { findFirst: mockCommentFindFirst, create: mockCommentCreate },
    poll: { findUnique: mockPollFindUnique },
    pollOption: { findUnique: mockPollOptionFindUnique },
    pollVote: { deleteMany: mockPollVoteDeleteMany, upsert: mockPollVoteUpsert },
    potluckItem: { findUnique: mockPotluckItemFindUnique },
    potluckClaim: { create: mockPotluckClaimCreate },
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

import { addComment, castVote, claimPotluckItem } from "@/app/actions/event";

const EVENT_ID = "evt-1";

describe("SEC-24: guest actions authorize by secret editToken, not public rsvpId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null); // unauthenticated guest
  });

  it("addComment: rejects a guest who knows the public rsvpId/name but not the token", async () => {
    mockEventFindUnique.mockResolvedValue({
      slug: "party",
      commentsEnabled: true,
      hostId: "host-1",
      visibility: "PUBLIC",
      coHosts: [],
    });
    // No token supplied → helper never queries the DB and the comment is rejected.
    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Alice", // a name lifted from the public guest list
      body: "posing as Alice",
    });

    expect(result).toEqual({
      success: false,
      error: "A valid approved RSVP is required to comment.",
    });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("addComment: with a valid token, stores the RSVP name and looks up by editToken", async () => {
    mockEventFindUnique.mockResolvedValue({
      slug: "party",
      commentsEnabled: true,
      hostId: "host-1",
      visibility: "PUBLIC",
      coHosts: [],
    });
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-alice", guestName: "Alice" });
    mockCommentCreate.mockResolvedValue({ id: "comment-1" });

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "The Host", // spoof attempt — must be ignored
      body: "hi",
      guestEditToken: "tok-alice",
    });

    expect(result).toEqual({ success: true, id: "comment-1" });
    // Authorized by the SECRET token, not a public id.
    expect(mockRsvpFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editToken: "tok-alice", eventId: EVENT_ID, approved: true },
      })
    );
    // Stored name is the RSVP's, never the client-supplied "The Host".
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guestName: "Alice", rsvpId: "rsvp-alice" }),
      })
    );
  });

  it("castVote: guest is authorized by editToken and votes under the RSVP name", async () => {
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      eventId: EVENT_ID,
      multiChoice: false,
      hideVoters: true,
      locked: false,
      event: { hostId: "host-1", slug: "party", coHosts: [] },
    });
    mockPollOptionFindUnique.mockResolvedValue({ id: "opt-1", text: "Pizza" });
    mockRsvpFindFirst.mockResolvedValue({ id: "rsvp-alice", guestName: "Alice" });

    await castVote("poll-1", "opt-1", "Mallory", true, "tok-alice"); // client claims "Mallory"

    expect(mockRsvpFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editToken: "tok-alice", eventId: EVENT_ID, approved: true },
      })
    );
    expect(mockPollVoteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollOptionId_voterName: { pollOptionId: "opt-1", voterName: "Alice" } },
      })
    );
  });

  it("claimPotluckItem: a guest with no token is rejected", async () => {
    mockPotluckItemFindUnique.mockResolvedValue({
      id: "item-1",
      label: "Soda",
      quantity: 5,
      claims: [],
      event: { slug: "party", hostId: "host-1", coHosts: [] },
    });

    const result = await claimPotluckItem("item-1", "Alice", 1); // no token
    expect(result).toEqual({
      success: false,
      error: "A valid approved RSVP is required to claim items.",
    });
    expect(mockPotluckClaimCreate).not.toHaveBeenCalled();
  });
});

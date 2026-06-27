// SEC-13 — Cross-event parent comment.
//
// Bug (found 2026-06, security review): when a comment was created with a
// `parentId`, `addComment` passed it straight into `db.comment.create` without
// verifying the parent belonged to the same `eventId`. A guest could POST a
// reply to Event A that threaded under a comment from Event B, silently
// corrupting comment trees across events.
//
// Fix: before inserting a reply, resolve the parent with
// `where: { id: parentId, eventId: data.eventId }` and reject if it isn't found.
// Folded in with SEC-17 since both live in `addComment`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSession,
  mockEventFindUnique,
  mockUserFindUnique,
  mockCommentFindFirst,
  mockCommentCreate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEventFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockCommentFindFirst: vi.fn(),
  mockCommentCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    user: { findUnique: mockUserFindUnique },
    rSVP: { findFirst: vi.fn() },
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

const EVENT_ID = "event-A";

describe("SEC-13: cross-event parent comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Author is the host of Event A — passes SEC-17 authorization cleanly so the
    // test isolates the parent-comment check.
    mockGetSession.mockResolvedValue({ userId: "host-A", email: "h@a.z", role: "HOST" });
    mockEventFindUnique.mockResolvedValue({
      slug: "event-a",
      commentsEnabled: true,
      hostId: "host-A",
      coHosts: [],
    });
    mockUserFindUnique.mockResolvedValue({ name: "Host A", email: "h@a.z" });
    mockCommentCreate.mockResolvedValue({ id: "comment-1" });
  });

  it("rejects a reply whose parent belongs to a different event", async () => {
    // The parent lookup is scoped to { id, eventId: EVENT_ID }; a parent from
    // Event B does not match, so findFirst resolves null.
    mockCommentFindFirst.mockResolvedValue(null);

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Host A",
      body: "reply that should not thread cross-event",
      parentId: "comment-from-event-B",
    });

    expect(result).toEqual({ success: false, error: "Invalid parent comment." });
    expect(mockCommentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "comment-from-event-B", eventId: EVENT_ID } })
    );
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("allows a reply whose parent belongs to the same event", async () => {
    mockCommentFindFirst.mockResolvedValue({ id: "parent-in-A" });

    const result = await addComment({
      eventId: EVENT_ID,
      guestName: "Host A",
      body: "valid reply",
      parentId: "parent-in-A",
    });

    expect(result).toEqual({ success: true, id: "comment-1" });
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: "parent-in-A" }),
      })
    );
  });
});

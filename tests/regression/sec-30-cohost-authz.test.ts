// SEC-30 / M-7 — Inconsistent host/co-host authorization across event mutations.
//
// Bug (found 2026-07, security review): ~15 server actions in
// app/actions/event.ts re-implemented the owner/admin check inline, and a
// dozen event mutations (saveEventField, updateInfoSection, saveEventSettings,
// cover image, blasts, …) were gated host-only even though the UI
// (app/e/[slug]/page.tsx isHost includes co-hosts) and docs/host/co-hosting.md
// promise co-hosts can edit the event. Result: co-hosts saw edit controls but
// every save threw Forbidden; meanwhile each hand-rolled check was one refactor
// away from diverging from the trust model.
//
// Fix: every event-scoped mutation now routes through the shared assertHost /
// assertHostOrCohost helpers. Co-hosts can manage the event; deleting the
// event and adding/removing co-hosts deliberately stay host-only. (Also folds
// in L-1: updateInfoSection no longer force-nulls `title` on every edit.)

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEventFindUnique,
  mockEventUpdate,
  mockInfoSectionFindUnique,
  mockInfoSectionUpdate,
  mockEventCoHostFindUnique,
  mockEventCoHostDelete,
  mockEventCoHostUpdate,
  mockTransaction,
  mockGetSession,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockEventUpdate: vi.fn(),
  mockInfoSectionFindUnique: vi.fn(),
  mockInfoSectionUpdate: vi.fn(),
  mockEventCoHostFindUnique: vi.fn(),
  mockEventCoHostDelete: vi.fn(),
  mockEventCoHostUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    db: {
      event: { findUnique: mockEventFindUnique, update: mockEventUpdate },
      eventInfoSection: {
        findUnique: mockInfoSectionFindUnique,
        update: mockInfoSectionUpdate,
        deleteMany: mockDeleteMany,
      },
      eventCoHost: {
        findUnique: mockEventCoHostFindUnique,
        delete: mockEventCoHostDelete,
        update: mockEventCoHostUpdate,
        deleteMany: mockDeleteMany,
      },
      activityEvent: { create: vi.fn().mockResolvedValue({}), deleteMany: mockDeleteMany },
      rSVPAnswer: { deleteMany: mockDeleteMany },
      plusOneGuest: { deleteMany: mockDeleteMany },
      rSVP: { deleteMany: mockDeleteMany },
      checkIn: { deleteMany: mockDeleteMany },
      comment: { deleteMany: mockDeleteMany },
      pollVote: { deleteMany: mockDeleteMany },
      pollOption: { deleteMany: mockDeleteMany },
      poll: { deleteMany: mockDeleteMany },
      potluckClaim: { deleteMany: mockDeleteMany },
      potluckItem: { deleteMany: mockDeleteMany },
      invitation: { deleteMany: mockDeleteMany },
      eventUpdate: { deleteMany: mockDeleteMany },
      sentReminder: { deleteMany: mockDeleteMany },
      $transaction: mockTransaction,
    },
  };
});

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

import {
  saveEventField,
  saveEventSettings,
  updateInfoSection,
  removeCoHost,
  deleteEvent,
  updateCoHostDisplayName,
} from "@/app/actions/event";

const HOST_ID = "host-1";
const COHOST_ID = "cohost-1";
const STRANGER_ID = "stranger-1";
const EVENT_ID = "event-1";

function eventRow(overrides = {}) {
  return {
    id: EVENT_ID,
    hostId: HOST_ID,
    slug: "party",
    status: "ACTIVE",
    coHosts: [{ userId: COHOST_ID }],
    ...overrides,
  };
}

function asCohost() {
  mockGetSession.mockResolvedValue({ userId: COHOST_ID, email: "cohost@example.com" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEventFindUnique.mockResolvedValue(eventRow());
  mockEventUpdate.mockResolvedValue({});
});

describe("SEC-30: co-hosts can manage the event (previously Forbidden)", () => {
  it("co-host can save an inline event field", async () => {
    asCohost();
    await saveEventField(EVENT_ID, "title", "New Title");
    expect(mockEventUpdate).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { title: "New Title" },
    });
  });

  it("co-host can save event settings", async () => {
    asCohost();
    const result = await saveEventSettings(EVENT_ID, { commentsEnabled: false });
    expect(result).toEqual({ success: true });
    expect(mockEventUpdate).toHaveBeenCalled();
  });

  it("co-host can edit an info section", async () => {
    asCohost();
    mockInfoSectionFindUnique.mockResolvedValue({
      id: "section-1",
      eventId: EVENT_ID,
      type: "PARKING",
      event: { slug: "party" },
    });
    mockInfoSectionUpdate.mockResolvedValue({});
    const result = await updateInfoSection("section-1", { content: "Lot B", url: null });
    expect(result.success).toBe(true);
  });

  it("a non-co-host stranger is still Forbidden", async () => {
    mockGetSession.mockResolvedValue({ userId: STRANGER_ID, email: "s@example.com" });
    await expect(saveEventField(EVENT_ID, "title", "X")).rejects.toThrow("Forbidden");
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });
});

describe("SEC-30: destructive owner actions stay host-only", () => {
  it("co-host cannot remove another co-host", async () => {
    asCohost();
    mockEventCoHostFindUnique.mockResolvedValue({
      userId: "another-cohost-user",
      eventId: EVENT_ID,
      event: { slug: "party" },
    });
    await expect(removeCoHost("ch-1")).rejects.toThrow("Forbidden");
    expect(mockEventCoHostDelete).not.toHaveBeenCalled();
  });

  it("co-host can remove themselves", async () => {
    asCohost();
    mockEventCoHostFindUnique.mockResolvedValue({
      userId: COHOST_ID,
      eventId: EVENT_ID,
      event: { slug: "party" },
    });
    await removeCoHost("ch-1");
    expect(mockEventCoHostDelete).toHaveBeenCalledWith({ where: { id: "ch-1" } });
  });

  it("co-host can update their own display name", async () => {
    asCohost();
    mockEventCoHostFindUnique.mockResolvedValue({
      userId: COHOST_ID,
      eventId: EVENT_ID,
      event: { slug: "party" },
    });
    await updateCoHostDisplayName("ch-1", "New Name");
    expect(mockEventCoHostUpdate).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      data: { displayName: "New Name" },
    });
  });

  it("co-host cannot update another co-host's display name", async () => {
    asCohost();
    mockEventCoHostFindUnique.mockResolvedValue({
      userId: "another-cohost-user",
      eventId: EVENT_ID,
      event: { slug: "party" },
    });
    await expect(updateCoHostDisplayName("ch-1", "New Name")).rejects.toThrow("Forbidden");
    expect(mockEventCoHostUpdate).not.toHaveBeenCalled();
  });

  it("co-host cannot delete the event", async () => {
    asCohost();
    await expect(deleteEvent(EVENT_ID)).rejects.toThrow("Forbidden");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("a non-co-host stranger cannot delete the event", async () => {
    mockGetSession.mockResolvedValue({ userId: STRANGER_ID, email: "s@example.com" });
    await expect(deleteEvent(EVENT_ID)).rejects.toThrow("Forbidden");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("L-1 (folded into SEC-30): updateInfoSection no longer force-nulls title", () => {
  beforeEach(() => {
    asCohost();
    mockInfoSectionFindUnique.mockResolvedValue({
      id: "section-1",
      eventId: EVENT_ID,
      type: "PARKING",
      event: { slug: "party" },
    });
    mockInfoSectionUpdate.mockResolvedValue({});
  });

  it("keeps the stored title when the caller does not send one", async () => {
    await updateInfoSection("section-1", { content: "Lot B", url: null });
    const data = mockInfoSectionUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("title");
  });

  it("persists a provided title", async () => {
    await updateInfoSection("section-1", { title: "Parking", content: "Lot B", url: null });
    const data = mockInfoSectionUpdate.mock.calls[0][0].data;
    expect(data.title).toBe("Parking");
  });
});

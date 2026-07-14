import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  assertHostOrCohost: vi.fn(),
  getChannelConfig: vi.fn(),
  rsvpFindUnique: vi.fn(),
  rsvpFindMany: vi.fn(),
  rsvpCreate: vi.fn(),
  checkInFindUnique: vi.fn(),
  checkInCreate: vi.fn(),
  checkInDeleteMany: vi.fn(),
  userUpsert: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/config", () => ({ getChannelConfig: mocks.getChannelConfig }));
vi.mock("@/lib/auth", () => ({ normalizePhone: (value: string) => value.replace(/[^+\d]/g, "") }));
vi.mock("@/app/actions/event/shared", () => ({
  assertHostOrCohost: mocks.assertHostOrCohost,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    rSVP: {
      findUnique: mocks.rsvpFindUnique,
      findMany: mocks.rsvpFindMany,
      create: mocks.rsvpCreate,
    },
    checkIn: {
      findUnique: mocks.checkInFindUnique,
      create: mocks.checkInCreate,
      deleteMany: mocks.checkInDeleteMany,
    },
    user: { upsert: mocks.userUpsert },
    activityEvent: { create: mocks.activityCreate },
    $transaction: mocks.transaction,
  },
}));

import { addWalkIn, checkInRsvp, undoCheckIn } from "@/app/actions/event/checkins";

const eligibleRsvp = {
  id: "rsvp-1",
  eventId: "event-1",
  guestName: "Ada Guest",
  approved: true,
  status: "GOING",
  event: { slug: "party" },
};

describe("event check-in actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      userId: "host-1",
      email: "host@example.com",
      role: "HOST",
    });
    mocks.assertHostOrCohost.mockResolvedValue({ id: "event-1", slug: "party" });
    mocks.getChannelConfig.mockResolvedValue({ email: true, sms: true });
    mocks.rsvpFindUnique.mockResolvedValue(eligibleRsvp);
    mocks.rsvpFindMany.mockResolvedValue([]);
    mocks.checkInFindUnique.mockResolvedValue(null);
    mocks.checkInDeleteMany.mockResolvedValue({ count: 1 });
    mocks.activityCreate.mockResolvedValue({});
  });

  it("creates one whole-party check-in attributed to the organizer", async () => {
    const checkedInAt = new Date("2026-07-14T20:00:00Z");
    mocks.checkInCreate.mockResolvedValue({
      id: "check-1",
      eventId: "event-1",
      rsvpId: "rsvp-1",
      checkedInAt,
      checkedInBy: "host@example.com",
    });

    const result = await checkInRsvp("rsvp-1");

    expect(result).toMatchObject({ success: true, alreadyCheckedIn: false });
    expect(mocks.checkInCreate).toHaveBeenCalledWith({
      data: {
        eventId: "event-1",
        rsvpId: "rsvp-1",
        checkedInBy: "host@example.com",
      },
    });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "check_in", actorName: "host@example.com" }),
    });
  });

  it("checks in a guest regardless of RSVP status", async () => {
    mocks.rsvpFindUnique.mockResolvedValue({ ...eligibleRsvp, status: "NO" });
    mocks.checkInCreate.mockResolvedValue({
      id: "check-no",
      eventId: "event-1",
      rsvpId: "rsvp-1",
      checkedInAt: new Date("2026-07-14T20:00:00Z"),
      checkedInBy: "host@example.com",
    });

    await expect(checkInRsvp("rsvp-1")).resolves.toMatchObject({ success: true });
    expect(mocks.checkInCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ rsvpId: "rsvp-1" }),
    });
  });

  it("undoes idempotently and records activity only when a row existed", async () => {
    await expect(undoCheckIn("rsvp-1")).resolves.toEqual({
      success: true,
      wasCheckedIn: true,
    });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "check_in_undo" }),
    });

    mocks.activityCreate.mockClear();
    mocks.checkInDeleteMany.mockResolvedValue({ count: 0 });
    await expect(undoCheckIn("rsvp-1")).resolves.toEqual({
      success: true,
      wasCheckedIn: false,
    });
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("returns an existing contact match without creating a duplicate", async () => {
    mocks.rsvpFindMany.mockResolvedValue([
      {
        id: "existing-1",
        guestName: "Existing Guest",
        status: "MAYBE",
        approved: false,
      },
    ]);
    const checkIn = {
      id: "check-existing",
      eventId: "event-1",
      rsvpId: "existing-1",
      checkedInAt: new Date("2026-07-14T20:00:00Z"),
      checkedInBy: "host@example.com",
    };
    mocks.checkInCreate.mockResolvedValue(checkIn);

    await expect(
      addWalkIn({
        eventId: "event-1",
        guestName: "Door Guest",
        totalPartySize: 2,
        guestEmail: "guest@example.com",
      })
    ).resolves.toEqual({
      success: true,
      kind: "existing",
      rsvpId: "existing-1",
      guestName: "Existing Guest",
      status: "MAYBE",
      approved: false,
      checkIn,
      alreadyCheckedIn: false,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.checkInCreate).toHaveBeenCalledWith({
      data: {
        eventId: "event-1",
        rsvpId: "existing-1",
        checkedInBy: "host@example.com",
      },
    });
  });

  it("creates and checks in a walk-in party without sending notifications", async () => {
    mocks.userUpsert.mockResolvedValue({ id: "guest-user" });
    const createdAt = new Date("2026-07-14T20:00:00Z");
    const checkedInAt = new Date("2026-07-14T20:01:00Z");
    const rsvp = {
      id: "walkin-1",
      guestName: "Door Guest",
      guestEmail: "guest@example.com",
      guestPhone: null,
      status: "GOING",
      plusOneCount: 2,
      approved: true,
      note: null,
      createdAt,
      editToken: "token",
    };
    const checkIn = { id: "check-1", checkedInAt, checkedInBy: "host@example.com" };
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        rSVP: { create: vi.fn().mockResolvedValue(rsvp) },
        checkIn: { create: vi.fn().mockResolvedValue(checkIn) },
      })
    );

    const result = await addWalkIn({
      eventId: "event-1",
      guestName: "Door Guest",
      totalPartySize: 3,
      guestEmail: "guest@example.com",
    });

    expect(result).toMatchObject({ success: true, kind: "created", rsvp, checkIn });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "walk_in" }),
    });
  });

  it("rejects contact fields when their channel is disabled", async () => {
    mocks.getChannelConfig.mockResolvedValue({ email: false, sms: true });

    await expect(
      addWalkIn({
        eventId: "event-1",
        guestName: "Door Guest",
        totalPartySize: 1,
        guestEmail: "guest@example.com",
      })
    ).resolves.toEqual({ success: false, error: "Email is not enabled for this site." });
  });

  it("authenticates before validating walk-in input", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(addWalkIn({})).rejects.toThrow("Unauthorized");
    expect(mocks.assertHostOrCohost).not.toHaveBeenCalled();
  });
});

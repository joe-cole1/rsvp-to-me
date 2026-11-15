// #848 root cause: RSVP settings were client-only, edits ignored the deadline
// override, and declining retained companions. All guest channels now share rules.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { createGuestRsvp, updateGuestRsvp } from "@/lib/rsvp-service";
import { notifyRsvp, notifyHostAlert } from "@/lib/notifications/service";
import { matchesSmsPhone, normalizePhone, smsPhoneVariants } from "@/lib/phone";
import { withEventCapacityLock } from "@/lib/capacityLock";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    $executeRaw: vi.fn(),
    event: { findUnique: vi.fn() },
    user: { upsert: vi.fn() },
    rSVP: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
    rSVPAnswer: { upsert: vi.fn(), createMany: vi.fn() },
    invitation: { findUnique: vi.fn(), updateMany: vi.fn() },
    checkIn: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: async () => ({ decision: "granted" }) }));
vi.mock("@/lib/notifications/service", () => ({ notifyRsvp: vi.fn(), notifyHostAlert: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));

const event = () => ({
  id: "event",
  slug: "party",
  title: "Party",
  status: "PUBLISHED",
  startAt: new Date("2099-01-01"),
  rsvpDeadline: null,
  allowEditAfterDeadline: false,
  maybeEnabled: true,
  plusOneAllowed: true,
  plusOneMax: 3,
  plusOneNamesRequired: false,
  capacity: 2,
  approvalRequired: false,
  rsvpFields: [],
  host: { email: null },
  coHosts: [],
  hostAlertEmail: false,
  hostAlertSms: false,
});
const row = () => ({
  id: "rsvp",
  editToken: "secret",
  eventId: "event",
  guestName: "Guest",
  status: "MAYBE",
  responded: true,
  approved: true,
  plusOneCount: 0,
  plusOneGuests: [],
  note: null,
  event: event(),
});
function setEvent(overrides: Record<string, unknown>) {
  const current = { ...event(), ...overrides };
  vi.mocked(db.event.findUnique).mockResolvedValue(current as never);
  vi.mocked(db.rSVP.findUnique).mockResolvedValue({ ...row(), event: current } as never);
}
const add = (data = {}) =>
  createGuestRsvp(
    AddRsvpSchema.parse({ eventId: "event", guestName: "Guest", status: "GOING", ...data })
  );
const edit = (data = {}) =>
  updateGuestRsvp("secret", UpdateRsvpSchema.parse({ status: "GOING", ...data }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$executeRaw).mockResolvedValue(1);
  setEvent({});
  vi.mocked(db.rSVP.count).mockResolvedValue(0);
  vi.mocked(db.rSVP.create).mockResolvedValue({ id: "rsvp", editToken: "secret" } as never);
  vi.mocked(db.rSVP.update).mockResolvedValue({} as never);
  vi.mocked(notifyRsvp).mockResolvedValue(undefined as never);
  vi.mocked(notifyHostAlert).mockResolvedValue(undefined as never);
});

describe("#848: server RSVP rules", () => {
  it.each([add, edit])("rejects disabled Maybe and forbidden/excess plus-ones", async (submit) => {
    setEvent({ maybeEnabled: false, plusOneAllowed: false });
    expect(await submit({ status: "MAYBE" })).toMatchObject({
      success: false,
      reason: "maybeDisabled",
    });
    expect(await submit({ plusOneCount: 1 })).toMatchObject({
      success: false,
      reason: "invalidRsvp",
    });
    setEvent({ plusOneMax: 2 });
    expect(await submit({ plusOneCount: 3 })).toMatchObject({
      success: false,
      reason: "invalidRsvp",
    });
    expect(db.rSVP.create).not.toHaveBeenCalled();
    expect(db.rSVP.update).not.toHaveBeenCalled();
  });
  it.each([add, edit])(
    "requires the configured companion names and rejects surplus names",
    async (submit) => {
      setEvent({ plusOneNamesRequired: true });
      for (const names of [undefined, [], [""], ["A", "B"]]) {
        expect(await submit({ plusOneCount: 1, plusOneGuestNames: names })).toMatchObject({
          success: false,
          reason: "invalidRsvp",
        });
      }
      expect(await submit({ plusOneCount: 1, plusOneGuestNames: ["Alice"] })).toMatchObject({
        success: true,
      });
    }
  );
  it("honors configured limits above the old hardcoded 10", async () => {
    setEvent({ plusOneMax: 20 });
    expect(await add({ plusOneCount: 20 })).toMatchObject({ success: true });
    expect(await edit({ plusOneCount: 20 })).toMatchObject({ success: true });
  });
  it("allows post-deadline edits only with the setting or an existing late decline", async () => {
    setEvent({ rsvpDeadline: new Date("2000-01-01") });
    expect(await add()).toMatchObject({ reason: "deadlinePassed" });
    expect(await edit()).toMatchObject({ reason: "deadlinePassed" });
    expect(await edit({ status: "NO" })).toMatchObject({ success: true });
    setEvent({ rsvpDeadline: new Date("2000-01-01"), allowEditAfterDeadline: true });
    expect(await edit()).toMatchObject({ success: true });
    expect(await add()).toMatchObject({ reason: "deadlinePassed" });
  });
  it.each([add, edit])(
    "rejects all guest responses after start or on inactive events",
    async (submit) => {
      setEvent({ startAt: new Date("2000-01-01"), allowEditAfterDeadline: true });
      expect(await submit({ status: "NO" })).toMatchObject({ reason: "eventStarted" });
      setEvent({ status: "CANCELLED" });
      expect(await submit()).toMatchObject({ reason: "forbidden" });
    }
  );
  it.each([add, edit])(
    "clears counts and names when declining or choosing Maybe",
    async (submit) => {
      for (const status of ["NO", "MAYBE"]) {
        expect(
          await submit({ status, plusOneCount: 3, plusOneGuestNames: ["A", "B", "C"] })
        ).toMatchObject({ success: true });
        const write = submit === add ? db.rSVP.create : db.rSVP.update;
        expect(write).toHaveBeenLastCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status, plusOneCount: 0 }) })
        );
        expect(db.plusOneGuest.createMany).not.toHaveBeenCalled();
      }
      if (submit === edit)
        expect(db.plusOneGuest.deleteMany).toHaveBeenCalledWith({ where: { rsvpId: "rsvp" } });
    }
  );
  it("reads current RSVP state after acquiring the lock, avoiding a stale transition", async () => {
    vi.mocked(db.rSVP.findUnique)
      .mockResolvedValueOnce(row() as never)
      .mockResolvedValue({ ...row(), status: "GOING" } as never);
    vi.mocked(db.rSVP.count).mockResolvedValue(2);
    expect(await edit()).toMatchObject({ success: true });
    expect(db.rSVP.count).not.toHaveBeenCalled();
  });
  it("fails closed when the PostgreSQL lock fails", async () => {
    vi.mocked(db.$executeRaw).mockRejectedValueOnce(new Error("database unavailable"));
    const callback = vi.fn();
    await expect(withEventCapacityLock("event", callback)).rejects.toThrow("database unavailable");
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("#848: shared phone matching", () => {
  it.each([
    [" (555) 123-4567 ", "5551234567"],
    ["+44 (7911) 123-456", "+447911123456"],
  ])("normalizes %s", (value, expected) => expect(normalizePhone(value)).toBe(expected));
  it("matches bounded legacy US forms without guessing other countries or merging accounts", () => {
    expect(matchesSmsPhone("(555) 123-4567", "+15551234567")).toBe(true);
    expect(matchesSmsPhone("15551234567", "+15551234567")).toBe(true);
    expect(matchesSmsPhone("+44 7911 123456", "+447911123456")).toBe(true);
    expect(matchesSmsPhone("07911123456", "+447911123456")).toBe(false);
    expect(smsPhoneVariants("invalid")).toEqual([]);
    expect(matchesSmsPhone(null, "+15551234567")).toBe(false);
  });
});

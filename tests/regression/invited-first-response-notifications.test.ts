// Regression test: an invited guest's first RSVP sent no host alert or confirmation.
//
// Found: 2026-10-23 browser QA of named invitations (#749), fixed in cb58e723.
// Root cause: host-invited guests answer through their edit-token link, which
// calls `updateRSVP`. Only `addRSVP` (the public RSVP form) sent the host "New
// RSVP" alert and the guest's confirmation, and `updateRSVP` logged the answer
// as an update. The first response is now claimed atomically
// (`responded: false` → `true`) so it notifies exactly once, using the contact
// already on the RSVP.
//
// Follow-up (de78391d, QC of #755): the claim committed on its own, before the
// RSVP update and its plus-one/answer/check-in writes. A failed save left the
// RSVP INVITED but claimed, so the retry succeeded silently as an "update". The
// claim now commits in one transaction with the save, and notifications start
// only after it commits.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRsvpFindUnique,
  mockRsvpUpdate,
  mockRsvpUpdateMany,
  mockRsvpGroupBy,
  mockConfirmEmail,
  mockConfirmSms,
  mockAlertEmail,
  mockAlertSms,
  mockActivity,
  claim,
} = vi.hoisted(() => ({
  mockRsvpFindUnique: vi.fn(),
  mockRsvpUpdate: vi.fn(),
  mockRsvpUpdateMany: vi.fn(),
  mockRsvpGroupBy: vi.fn(),
  mockConfirmEmail: vi.fn(),
  mockConfirmSms: vi.fn(),
  mockAlertEmail: vi.fn(),
  mockAlertSms: vi.fn(),
  mockActivity: vi.fn(),
  // The committed `responded` flag for stateful cases; a failed transaction restores it.
  claim: { responded: false },
}));

vi.mock("@/lib/db", () => ({
  db: {
    async $transaction(action: (client: unknown) => Promise<unknown>) {
      const committed = claim.responded;
      try {
        return await action(this);
      } catch (error) {
        claim.responded = committed;
        throw error;
      }
    },
    event: { findUnique: async () => (await mockRsvpFindUnique()).event },
    notificationSettings: { findMany: async () => [] },
    notificationConnection: { findMany: async () => [] },
    notificationBinding: { findMany: async () => [] },
    rSVP: {
      findUnique: mockRsvpFindUnique,
      update: mockRsvpUpdate,
      updateMany: mockRsvpUpdateMany,
      groupBy: mockRsvpGroupBy,
      count: vi.fn().mockResolvedValue(0),
    },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
    rSVPAnswer: { upsert: vi.fn() },
    checkIn: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/email", async () => {
  const { captureAdapter } = await import("@/tests/helpers/notification-adapter");
  return {
    createEmailNotificationAdapter: async () =>
      captureAdapter("email", async (message, target) => {
        if (message.kind === "host_alert")
          return mockAlertEmail(target.destination, { ...message.options, locale: target.locale });
        if (message.kind === "confirmation")
          return mockConfirmEmail(target.destination, {
            ...message.options,
            locale: target.locale,
          });
      }),
  };
});
vi.mock("@/lib/sms", async () => {
  const { captureAdapter } = await import("@/tests/helpers/notification-adapter");
  return {
    createSmsNotificationAdapter: async () =>
      captureAdapter("sms", async (message, target) => {
        if (message.kind === "host_alert")
          return mockAlertSms(target.destination, { ...message.options, locale: target.locale });
        if (message.kind === "confirmation")
          return mockConfirmSms(target.destination, { ...message.options, locale: target.locale });
      }),
  };
});
vi.mock("@/lib/activity", () => ({ logActivity: mockActivity, iconLabel: vi.fn() }));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: vi.fn((_eventId: string, fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

import { updateRSVP } from "@/app/actions/event";

const THEME = { baseTheme: "DARK" };

function invitedRsvp(overrides: Record<string, unknown> = {}) {
  return {
    id: "rsvp-1",
    eventId: "event-1",
    editToken: "tok-1",
    guestName: "Alice QA",
    guestEmail: "alice@example.com",
    guestPhone: null,
    status: "INVITED",
    responded: false,
    note: null,
    checkIn: null,
    user: { preferredLocale: "de-DE" },
    event: {
      id: "event-1",
      slug: "party",
      title: "Party",
      capacity: null,
      rsvpDeadline: null,
      startAt: new Date("2099-01-01T20:00:00Z"),
      endAt: null,
      timezone: "UTC",
      locationType: "PHYSICAL",
      locationName: "Home",
      locationAddress: null,
      virtualUrl: null,
      theme: THEME,
      hostAlertEmail: true,
      hostAlertSms: true,
      host: { id: "host", email: "host@example.com", phone: "+15551230000", preferredLocale: null },
      coHosts: [
        { user: { id: "cohost", email: "cohost@example.com", phone: null, preferredLocale: null } },
      ],
      rsvpFields: [],
    },
    ...overrides,
  };
}

const ANSWER = { status: "GOING" as const, plusOneCount: 1, guestName: "Alice QA", note: "Yay" };

async function flushAsync() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  claim.responded = false;
  mockRsvpUpdate.mockResolvedValue({});
  mockRsvpUpdateMany.mockResolvedValue({ count: 1 });
  mockRsvpGroupBy.mockResolvedValue([{ status: "GOING", _count: { _all: 4 } }]);
  for (const send of [mockConfirmEmail, mockConfirmSms, mockAlertEmail, mockAlertSms]) {
    send.mockResolvedValue(undefined);
  }
  mockActivity.mockResolvedValue(undefined);
});

describe("an invited guest's first response through the edit link", () => {
  it("claims the response once, confirms to the stored contact, and alerts hosts", async () => {
    mockRsvpFindUnique.mockResolvedValue(invitedRsvp());

    const result = await updateRSVP("tok-1", ANSWER);
    expect(result.success).toBe(true);

    expect(mockRsvpUpdateMany).toHaveBeenCalledWith({
      where: { id: "rsvp-1", responded: false },
      data: { responded: true },
    });
    await vi.waitFor(() => expect(mockConfirmEmail).toHaveBeenCalled());
    expect(mockConfirmEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.objectContaining({
        locale: "de-DE",
        guestName: "Alice QA",
        status: "GOING",
        editToken: "tok-1",
        replyTo: "host@example.com",
      })
    );
    expect(mockConfirmSms).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(mockAlertEmail).toHaveBeenCalledTimes(2));
    expect(mockAlertEmail).toHaveBeenCalledWith(
      "host@example.com",
      expect.objectContaining({ guestName: "Alice QA", status: "GOING", goingCount: 4 })
    );
    expect(mockAlertSms).not.toHaveBeenCalled(); // Preferred email acceptance stops SMS fallback.
    expect(mockActivity).toHaveBeenCalledWith(
      "event-1",
      "rsvp_new",
      "Alice QA is going +1\nYay",
      "Alice QA"
    );
  });

  it("texts the confirmation to an SMS-invited guest", async () => {
    mockRsvpFindUnique.mockResolvedValue(
      invitedRsvp({ guestEmail: null, guestPhone: "+15550001111" })
    );

    await updateRSVP("tok-1", ANSWER);

    expect(mockConfirmEmail).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(mockConfirmSms).toHaveBeenCalled());
    expect(mockConfirmSms).toHaveBeenCalledWith(
      "+15550001111",
      expect.objectContaining({ guestName: "Alice QA", editToken: "tok-1", status: "GOING" })
    );
  });

  it("sends nothing new when a concurrent submit already claimed the first response", async () => {
    mockRsvpFindUnique.mockResolvedValue(invitedRsvp());
    mockRsvpUpdateMany.mockResolvedValue({ count: 0 });

    await updateRSVP("tok-1", ANSWER);

    await flushAsync();
    expect(mockConfirmEmail).not.toHaveBeenCalled();
    expect(mockAlertEmail).not.toHaveBeenCalled();
    expect(mockAlertSms).not.toHaveBeenCalled();
    expect(mockActivity).toHaveBeenCalledWith(
      "event-1",
      "rsvp_update",
      "Alice QA updated to going",
      "Alice QA"
    );
  });

  it("keeps later edits quiet and logged as updates", async () => {
    mockRsvpFindUnique.mockResolvedValue(invitedRsvp({ status: "GOING", responded: true }));

    await updateRSVP("tok-1", { ...ANSWER, status: "MAYBE" });

    await flushAsync();
    expect(mockRsvpUpdateMany).not.toHaveBeenCalled();
    expect(mockConfirmEmail).not.toHaveBeenCalled();
    expect(mockAlertEmail).not.toHaveBeenCalled();
    expect(mockActivity).toHaveBeenCalledWith(
      "event-1",
      "rsvp_update",
      "Alice QA updated to maybe",
      "Alice QA"
    );
  });

  it("leaves the first response unclaimed when the save fails, so the retry notifies", async () => {
    mockRsvpFindUnique.mockImplementation(async () => invitedRsvp({ responded: claim.responded }));
    mockRsvpUpdateMany.mockImplementation(async () => {
      if (claim.responded) return { count: 0 };
      claim.responded = true;
      return { count: 1 };
    });
    mockRsvpUpdate.mockRejectedValueOnce(new Error("connection reset"));

    await expect(updateRSVP("tok-1", ANSWER)).rejects.toThrow("connection reset");
    expect(claim.responded).toBe(false);
    await flushAsync();
    expect(mockConfirmEmail).not.toHaveBeenCalled();
    expect(mockAlertEmail).not.toHaveBeenCalled();
    expect(mockActivity).not.toHaveBeenCalled();

    expect((await updateRSVP("tok-1", ANSWER)).success).toBe(true);
    await vi.waitFor(() => expect(mockConfirmEmail).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mockAlertEmail).toHaveBeenCalledTimes(2));
    expect(mockActivity).toHaveBeenCalledWith(
      "event-1",
      "rsvp_new",
      "Alice QA is going +1\nYay",
      "Alice QA"
    );
  });

  it("never fails the RSVP when a notification send rejects", async () => {
    mockRsvpFindUnique.mockResolvedValue(invitedRsvp());
    mockConfirmEmail.mockRejectedValue(new Error("SMTP down"));
    mockAlertEmail.mockRejectedValue(new Error("SMTP down"));

    const result = await updateRSVP("tok-1", ANSWER);

    expect(result.success).toBe(true);
    await flushAsync();
  });
});

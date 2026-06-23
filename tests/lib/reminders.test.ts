import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockEventFindMany: vi.fn(),
  mockSentReminderCreate: vi.fn().mockResolvedValue({}),
  mockSessionDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCronLockDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCronLockCreate: vi.fn().mockResolvedValue({}),
  mockCronLockDelete: vi.fn().mockResolvedValue({}),
  mockInvitationFindMany: vi.fn().mockResolvedValue([]),
  mockSendBlastEmail: vi.fn().mockResolvedValue(undefined),
  mockSendSmsBlast: vi.fn().mockResolvedValue(undefined),
  mockIsRedisEnabled: vi.fn().mockReturnValue(false),
  mockRedisAcquireLock: vi.fn().mockResolvedValue(true),
  mockRedisReleaseLock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findMany: mocks.mockEventFindMany },
    sentReminder: { create: mocks.mockSentReminderCreate },
    session: { deleteMany: mocks.mockSessionDeleteMany },
    cronLock: {
      deleteMany: mocks.mockCronLockDeleteMany,
      create: mocks.mockCronLockCreate,
      delete: mocks.mockCronLockDelete,
    },
    invitation: { findMany: mocks.mockInvitationFindMany },
  },
}));

vi.mock("@/lib/email", () => ({
  sendBlastEmail: mocks.mockSendBlastEmail,
}));

vi.mock("@/lib/sms", () => ({
  sendSmsBlast: mocks.mockSendSmsBlast,
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: mocks.mockIsRedisEnabled,
  redisAcquireLock: mocks.mockRedisAcquireLock,
  redisReleaseLock: mocks.mockRedisReleaseLock,
}));

import { processReminders } from "@/lib/reminders";

function makeReminderEvent(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "event-1",
    title: "Wine Night",
    slug: "wine-night",
    status: "PUBLISHED",
    startAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days out
    host: { name: "Alice" },
    reminderSettings: {
      emailWeekBefore: false,
      emailDayBefore: false,
      emailHoursBefore: 0,
      smsWeekBefore: false,
      smsDayBefore: false,
      smsHoursBefore: 0,
      nudgeUnresponded: false,
    },
    rsvps: [],
    sentReminders: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Set default resolutions for mocks to prevent undefined .catch errors
  mocks.mockSessionDeleteMany.mockResolvedValue({ count: 0 });
  mocks.mockCronLockDeleteMany.mockResolvedValue({ count: 0 });
  mocks.mockCronLockCreate.mockResolvedValue({});
  mocks.mockCronLockDelete.mockResolvedValue({});
  mocks.mockSentReminderCreate.mockResolvedValue({});
  mocks.mockInvitationFindMany.mockResolvedValue([]);
  mocks.mockSendBlastEmail.mockResolvedValue(undefined);
  mocks.mockSendSmsBlast.mockResolvedValue(undefined);
  mocks.mockIsRedisEnabled.mockReturnValue(false);
  mocks.mockRedisAcquireLock.mockResolvedValue(true);
  mocks.mockRedisReleaseLock.mockResolvedValue(undefined);
});

describe("processReminders — DB locking", () => {
  beforeEach(() => {
    mocks.mockIsRedisEnabled.mockReturnValue(false);
  });

  it("acquires a cronLock before processing (calls cronLock.create with jobName)", async () => {
    mocks.mockEventFindMany.mockResolvedValue([]);

    await processReminders();
    expect(mocks.mockCronLockCreate).toHaveBeenCalledWith({
      data: {
        jobName: "process_reminders",
        lockedAt: expect.any(Date),
        expireAt: expect.any(Date),
      },
    });
  });

  it("skips processing when cronLock.create throws (another instance holds lock)", async () => {
    mocks.mockCronLockCreate.mockRejectedValue(new Error("P2002 Unique constraint failed"));
    mocks.mockEventFindMany.mockResolvedValue([]);

    await processReminders();
    expect(mocks.mockEventFindMany).not.toHaveBeenCalled();
  });

  it("deletes stale cronLock entries before acquiring (calls cronLock.deleteMany)", async () => {
    mocks.mockEventFindMany.mockResolvedValue([]);

    await processReminders();
    expect(mocks.mockCronLockDeleteMany).toHaveBeenCalled();
  });

  it("deletes the cronLock in the finally block even when processing throws", async () => {
    mocks.mockEventFindMany.mockRejectedValue(new Error("Query failed"));

    await expect(processReminders()).rejects.toThrow("Query failed");
    expect(mocks.mockCronLockDelete).toHaveBeenCalledWith({
      where: { jobName: "process_reminders" },
    });
  });
});

describe("processReminders — Redis locking", () => {
  beforeEach(() => {
    mocks.mockIsRedisEnabled.mockReturnValue(true);
  });

  it("calls redisAcquireLock instead of cronLock.create", async () => {
    mocks.mockEventFindMany.mockResolvedValue([]);

    await processReminders();
    expect(mocks.mockRedisAcquireLock).toHaveBeenCalledWith("lock:cron:process_reminders", 600);
    expect(mocks.mockRedisReleaseLock).toHaveBeenCalledWith("lock:cron:process_reminders");
  });

  it("skips when Redis lock cannot be acquired", async () => {
    mocks.mockRedisAcquireLock.mockResolvedValue(false);
    await processReminders();
    expect(mocks.mockEventFindMany).not.toHaveBeenCalled();
  });
});

describe("processReminders — email reminders", () => {
  it("sends email_week when emailWeekBefore=true, event is within 7 days, guests have emails, not yet sent", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days out (<= 7 days)
      reminderSettings: {
        emailWeekBefore: true,
        emailDayBefore: false,
        emailHoursBefore: 0,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).toHaveBeenCalledWith(["bob@example.com"], expect.any(Object));
    expect(mocks.mockSentReminderCreate).toHaveBeenCalledWith({
      data: { eventId: "event-1", type: "email_week" },
    });
  });

  it("does NOT send email_week when already in sentReminders", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      reminderSettings: {
        emailWeekBefore: true,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
      sentReminders: [{ type: "email_week" }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).not.toHaveBeenCalled();
  });

  it("does NOT send email_week when event is > 7 days away", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days out (> 7 days)
      reminderSettings: {
        emailWeekBefore: true,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).not.toHaveBeenCalled();
  });

  it("excludes guests with user.emailNotifications=false", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      reminderSettings: {
        emailWeekBefore: true,
      },
      rsvps: [
        { guestEmail: "bob@example.com", approved: true, user: { emailNotifications: false } },
      ],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).not.toHaveBeenCalled();
  });

  it("sends email_day when emailDayBefore=true, event 24+ hours out (actually within 24 hours)", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours out (<= 24 hours)
      reminderSettings: {
        emailDayBefore: true,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).toHaveBeenCalledWith(["bob@example.com"], expect.any(Object));
  });

  it("sends email_hours when emailHoursBefore > 0, and event is within N hours", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours out
      reminderSettings: {
        emailHoursBefore: 3, // due at startAt - 3 hours
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).toHaveBeenCalledWith(["bob@example.com"], expect.any(Object));
  });
});

describe("processReminders — SMS reminders", () => {
  it("sends sms_week when smsWeekBefore=true, phones present, event 7+ days out (actually within 7 days)", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days out
      reminderSettings: {
        smsWeekBefore: true,
      },
      rsvps: [{ guestPhone: "15551234567", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendSmsBlast).toHaveBeenCalledWith(["15551234567"], expect.any(Object));
  });

  it("sends sms_day when smsDayBefore=true, phones present", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours out
      reminderSettings: {
        smsDayBefore: true,
      },
      rsvps: [{ guestPhone: "15551234567", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendSmsBlast).toHaveBeenCalledWith(["15551234567"], expect.any(Object));
  });

  it("sends sms_hours when smsHoursBefore > 0", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour out
      reminderSettings: {
        smsHoursBefore: 2,
      },
      rsvps: [{ guestPhone: "15551234567", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendSmsBlast).toHaveBeenCalledWith(["15551234567"], expect.any(Object));
  });

  it("excludes guests with user.smsNotifications=false", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      reminderSettings: {
        smsDayBefore: true,
      },
      rsvps: [{ guestPhone: "15551234567", approved: true, user: { smsNotifications: false } }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);

    await processReminders();
    expect(mocks.mockSendSmsBlast).not.toHaveBeenCalled();
  });
});

describe("processReminders — nudge", () => {
  it("nudge_email: queries invitations channel=EMAIL, sends to those not in rsvpEmails set", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days out (<= 3 days)
      reminderSettings: {
        nudgeUnresponded: true,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }], // bob already rsvp'd
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);
    mocks.mockInvitationFindMany.mockResolvedValue([
      { sentTo: "bob@example.com" },
      { sentTo: "alice@example.com" }, // alice has not rsvp'd
    ]);

    await processReminders();
    expect(mocks.mockInvitationFindMany).toHaveBeenCalledWith({
      where: { eventId: "event-1", channel: "EMAIL" },
      select: { sentTo: true },
    });
    expect(mocks.mockSendBlastEmail).toHaveBeenCalledWith(["alice@example.com"], expect.any(Object));
  });

  it("nudge_email: skips when no uninvited emails", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      reminderSettings: {
        nudgeUnresponded: true,
      },
      rsvps: [{ guestEmail: "bob@example.com", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);
    mocks.mockInvitationFindMany.mockResolvedValue([
      { sentTo: "bob@example.com" },
    ]);

    await processReminders();
    expect(mocks.mockSendBlastEmail).not.toHaveBeenCalled();
  });

  it("nudge_sms: queries invitations channel=SMS, sends to those not in rsvpPhones set", async () => {
    const event = makeReminderEvent({
      startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      reminderSettings: {
        nudgeUnresponded: true,
      },
      rsvps: [{ guestPhone: "15551234567", approved: true }],
    });
    mocks.mockEventFindMany.mockResolvedValue([event]);
    mocks.mockInvitationFindMany.mockResolvedValue([
      { sentTo: "15551234567" },
      { sentTo: "15559999999" },
    ]);

    await processReminders();
    expect(mocks.mockInvitationFindMany).toHaveBeenCalledWith({
      where: { eventId: "event-1", channel: "SMS" },
      select: { sentTo: true },
    });
    expect(mocks.mockSendSmsBlast).toHaveBeenCalledWith(["15559999999"], expect.any(Object));
  });
});

describe("processReminders — event filtering", () => {
  it("skips CANCELLED events", async () => {
    // The query filter status: { not: 'CANCELLED' } will prevent it from being fetched in prod,
    // but let's test if it handles it if returned or we check query
    await processReminders();
    expect(mocks.mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" },
          startAt: { gt: expect.any(Date) },
          reminderSettings: { isNot: null },
        }),
      })
    );
  });
});

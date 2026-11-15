import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  schedules: vi.fn(),
  due: vi.fn(),
  claim: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  dbLock: vi.fn(),
  cleanup: vi.fn(),
  unlock: vi.fn(),
  settings: vi.fn(),
  deliver: vi.fn(),
  redis: { enabled: false },
}));
vi.mock("@/lib/db", () => ({
  db: {
    notificationSchedule: { findUniqueOrThrow: mocks.schedules },
    $queryRaw: mocks.due,
    $executeRaw: (sql: TemplateStringsArray, ...args: unknown[]) =>
      sql.join("").includes("UPDATE") ? mocks.claim(sql, ...args) : Promise.resolve(1),
    async $transaction(action: (tx: unknown) => Promise<unknown>) {
      return action(this);
    },
    notificationSettings: { findMany: mocks.settings },
    notificationBinding: { findMany: async () => [] },
    notificationConnection: { findMany: async () => [] },
    cronLock: { create: mocks.dbLock, deleteMany: mocks.cleanup },
    session: { deleteMany: async () => ({ count: 0 }) },
  },
}));
vi.mock("@/lib/redis", () => ({
  isRedisEnabled: () => mocks.redis.enabled,
  redisAcquireLock: mocks.acquire,
  redisReleaseLock: mocks.release,
}));
vi.mock("@/lib/notifications/service", () => ({ deliver: mocks.deliver }));
import { processReminders } from "@/lib/reminders";
const guest = {
  id: "rsvp",
  guestEmail: "guest@example.com",
  guestPhone: "+15551234567",
  userId: "user",
  status: "GOING",
  responded: true,
  user: {
    notificationChannel: "BOTH",
    emailNotifications: true,
    smsNotifications: true,
    preferredLocale: "en-US",
  },
};
function schedule(overrides = {}) {
  return {
    id: "slot",
    hoursBefore: 2,
    kind: "reminder",
    recipientRouting: true,
    legacyChannels: [],
    event: {
      id: "event",
      title: "Party",
      slug: "party",
      theme: null,
      host: { name: "Host" },
      hostDisplayName: null,
      startAt: new Date("2026-12-01T13:00:00Z"),
      rsvps: [guest],
      invitations: [] as { rsvpId: string; channel: string; sentTo: string }[],
    },
    ...overrides,
  };
}
const candidate = { id: "slot", eventId: "event", startAt: new Date("2026-12-01T13:00:00Z") };
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
  mocks.redis.enabled = false;
  mocks.due.mockResolvedValue([]);
  mocks.schedules.mockResolvedValue(schedule());
  mocks.claim.mockResolvedValue(1);
  mocks.settings.mockResolvedValue([]);
  mocks.acquire.mockResolvedValue("owner-token");
  mocks.dbLock.mockResolvedValue({});
  mocks.cleanup.mockResolvedValue({ count: 0 });
  mocks.unlock.mockResolvedValue({});
  mocks.release.mockResolvedValue(undefined);
  mocks.deliver.mockResolvedValue({ summary: { accepted: 1 } });
});
afterEach(() => vi.useRealTimers());
describe("reminder locking and occurrence consumption", () => {
  it("acquires and releases the database cron lock", async () => {
    await processReminders();
    expect(mocks.cleanup).toHaveBeenCalled();
    expect(mocks.dbLock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jobName: "process_reminders" }) })
    );
    expect(mocks.cleanup).toHaveBeenLastCalledWith({
      where: {
        jobName: "process_reminders",
        lockedAt: expect.any(Date),
        expireAt: expect.any(Date),
      },
    });
  });
  it("skips when the database lock is already held", async () => {
    mocks.dbLock.mockRejectedValue(new Error("unique"));
    await processReminders();
    expect(mocks.schedules).not.toHaveBeenCalled();
  });
  it("releases the database lock when preparation fails", async () => {
    mocks.due.mockRejectedValue(new Error("Query failed"));
    await expect(processReminders()).rejects.toThrow("Query failed");
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  });
  it("uses Redis locking when enabled", async () => {
    mocks.redis.enabled = true;
    await processReminders();
    expect(mocks.acquire).toHaveBeenCalledWith("lock:cron:process_reminders", 600);
    expect(mocks.release).toHaveBeenCalledWith("lock:cron:process_reminders", "owner-token");
    expect(mocks.dbLock).not.toHaveBeenCalled();
  });
  it("skips when Redis lock acquisition fails", async () => {
    mocks.redis.enabled = true;
    mocks.acquire.mockResolvedValue(false);
    await processReminders();
    expect(mocks.schedules).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it("does not load event recipients when no occurrence is due", async () => {
    await processReminders();
    expect(mocks.due).toHaveBeenCalled();
    expect(mocks.schedules).not.toHaveBeenCalled();
  });
  it("does not consume a reminder before it is due", async () => {
    mocks.due.mockResolvedValue([]);
    await processReminders();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("atomically consumes the occurrence before any submission", async () => {
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(schedule());
    await processReminders();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deliver.mock.invocationCallOrder[0]
    );
  });
  it("does not send an occurrence already claimed by another scheduler", async () => {
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(schedule());
    mocks.claim.mockResolvedValue(0);
    await processReminders();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("does not retry consumed partial/uncertain submissions", async () => {
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(schedule());
    mocks.deliver.mockRejectedValue(new Error("private provider payload"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await processReminders();
    mocks.claim.mockResolvedValue(0);
    await processReminders();
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "[reminders] Occurrence consumed; notification preparation failed"
    );
    warning.mockRestore();
  });
});
describe("recipient-controlled reminders", () => {
  it("routes one logical reminder through the recipient's policy", async () => {
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(schedule());
    await processReminders();
    expect(mocks.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "event_update",
        body: "Party starts in 2 hours! See you soon.",
        smsBody: "Party starts in 2 hours!",
      }),
      [
        expect.objectContaining({
          policy: { channels: ["email", "sms"] },
          destinations: { email: guest.guestEmail, sms: guest.guestPhone },
          // Neither contact is proved, so they share one message.
          proved: [],
        }),
      ]
    );
  });
  it("retains a migrated email-only channel ceiling", async () => {
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(
      schedule({ recipientRouting: false, legacyChannels: ["email"] })
    );
    await processReminders();
    expect(mocks.deliver.mock.calls[0][1][0].policy.channels).toEqual(["email"]);
  });
  it("honors a reminder-category opt-out", async () => {
    mocks.settings.mockResolvedValue([
      {
        id: "profile:user",
        channels: ["email", "sms"],
        blockedChannels: [],
        categories: [{ category: "reminders", channels: [] }],
      },
    ]);
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(schedule());
    await processReminders();
    expect(mocks.deliver.mock.calls[0][1][0].policy.channels).toEqual([]);
  });
  it("does not use a historical invitation address as an opt-out bypass", async () => {
    const slot = schedule({ kind: "nudge" });
    slot.event.rsvps = [
      {
        ...guest,
        status: "INVITED",
        responded: false,
        user: { ...guest.user, emailNotifications: false, smsNotifications: false },
      },
    ];
    slot.event.invitations = [{ rsvpId: "rsvp", channel: "EMAIL", sentTo: guest.guestEmail }];
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(slot);
    await processReminders();
    expect(mocks.deliver.mock.calls[0][1][0].policy.channels).toEqual([]);
  });
  it("nudges only unanswered matching event contacts", async () => {
    const slot = schedule({ kind: "nudge" });
    slot.event.rsvps = [
      { ...guest, status: "INVITED", responded: false },
      { ...guest, id: "answered" },
    ];
    slot.event.invitations = [
      { rsvpId: "rsvp", channel: "EMAIL", sentTo: "stale@example.com" },
      { rsvpId: "foreign", channel: "SMS", sentTo: guest.guestPhone },
    ];
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(slot);
    await processReminders();
    expect(mocks.deliver.mock.calls[0][1]).toHaveLength(1);
    expect(mocks.deliver.mock.calls[0][1][0].destinations).toEqual({});
  });
  it("localizes each recipient group from stored locale", async () => {
    const slot = schedule();
    slot.event.rsvps = [
      guest,
      { ...guest, id: "nl", user: { ...guest.user, preferredLocale: "nl-NL" } },
    ];
    mocks.due.mockResolvedValue([candidate]);
    mocks.schedules.mockResolvedValue(slot);
    await processReminders();
    expect(mocks.deliver).toHaveBeenCalledTimes(2);
    expect(mocks.deliver.mock.calls[1][0].body).toBe("Party begint over 2 uur! Tot snel.");
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });
});

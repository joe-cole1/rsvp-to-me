// Regression (01a1a105 QC): reminder copy and schedule state regressed.
//
// Found: 2026-11-05 local QC.
// 1. Every reminder used "{event} starts in {hours} hours", so week-before reminders read
//    "starts in 168 hours" and the localized "one week away"/"tomorrow" copy was orphaned.
// 2. The schedule showed times that were already sent, or whose time had passed, as ordinary
//    checked times, so hosts expected a "1 week before" reminder that would never go out.
// 3. A failed schedule load said "Could not save".
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: vi.fn(), event: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    notificationSchedule: { findMany: m.rows },
    event: { findUniqueOrThrow: m.event },
  },
}));
vi.mock("@/lib/auth-guards", () => ({ assertHostOrCohost: m.guard }));
vi.mock("@/lib/redis", () => ({
  isRedisEnabled: () => false,
  redisAcquireLock: vi.fn(),
  redisReleaseLock: vi.fn(),
}));
import { getTranslator } from "@/i18n/server";
import { reminderCopy } from "@/lib/reminders";
import { getNotificationSchedule } from "@/app/actions/notification-schedule";

const hours = 3600000;
beforeEach(() => {
  vi.clearAllMocks();
  m.guard.mockResolvedValue({});
  m.event.mockResolvedValue({ startAt: new Date(Date.now() + 48 * hours) });
});

describe("reminder copy", () => {
  it("keeps natural week, day, hours and nudge wording for email and SMS", async () => {
    const t = await getTranslator("en-US");
    const render = (kind: string, value: number) =>
      reminderCopy(kind, value).map((key) => t(key, { eventTitle: "Party", hours: value }));
    expect(render("reminder", 168)[0]).toContain("one week away");
    expect(render("reminder", 24)).toEqual([
      "Party is tomorrow! See you then.",
      "Party is tomorrow! See you then.",
    ]);
    expect(render("reminder", 1)[1]).toBe("Party starts in 1 hour!");
    expect(render("nudge", 72)[1]).toContain("have you had a chance to RSVP");
  });
});

describe("schedule status", () => {
  it("labels consumed and already-passed times instead of presenting them as pending", async () => {
    m.rows.mockResolvedValue([
      {
        id: "a",
        kind: "reminder",
        hoursBefore: 24,
        enabled: true,
        recipientRouting: true,
        consumedAt: new Date(),
        legacyChannels: [],
      },
      {
        id: "b",
        kind: "reminder",
        hoursBefore: 4,
        enabled: true,
        recipientRouting: true,
        consumedAt: null,
        legacyChannels: [],
      },
    ]);
    const result = await getNotificationSchedule("event");
    if (!result.success) throw new Error("expected data");
    const status = Object.fromEntries(result.data.times.map((row) => [row.hours, row.status]));
    // 48 hours away: the week reminder can no longer send, the day one already did.
    expect(status).toMatchObject({ 168: "passed", 24: "done", 4: "pending" });
  });
  it("names the old channel limits a migrated schedule still uses", async () => {
    m.rows.mockResolvedValue([
      {
        id: "a",
        kind: "reminder",
        hoursBefore: 2,
        enabled: true,
        recipientRouting: false,
        consumedAt: null,
        legacyChannels: ["sms"],
      },
    ]);
    const result = await getNotificationSchedule("event");
    expect(result.success && result.data.legacy).toEqual([
      { kind: "reminder", hours: 2, channels: ["sms"] },
    ]);
  });
  it("reports a load failure as a load failure", async () => {
    m.guard.mockRejectedValue(new Error("Unauthorized"));
    expect(await getNotificationSchedule("event")).toEqual({
      success: false,
      error: "Could not load these settings.",
    });
  });
});

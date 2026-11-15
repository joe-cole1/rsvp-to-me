// #849 regression: exercise real date recomputation, due selection and claims in
// PostgreSQL; mocks of Prisma alone cannot verify the timestamp/interval SQL.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "../helpers/db";
const m = vi.hoisted(() => ({ guard: vi.fn(), deliver: vi.fn() }));
vi.mock("@/app/actions/event/shared", () => ({ assertHostOrCohost: m.guard, assertHost: m.guard }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => {} }));
vi.mock("@/lib/activity", () => ({ logActivity: async () => {} }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/notifications/service", () => ({ deliver: m.deliver }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveEventDates } from "@/app/actions/event/settings";
import { processReminders } from "@/lib/reminders";
async function fixture() {
  const host = await db.user.create({ data: { role: "HOST" } });
  const event = await db.event.create({
    data: {
      title: "Party",
      slug: "reminder-fixture",
      hostId: host.id,
      startAt: new Date("2099-01-01T12:00:00Z"),
      timezone: "UTC",
      status: "PUBLISHED",
    },
  });
  m.guard.mockResolvedValue(event);
  return event;
}
beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
  m.deliver.mockResolvedValue({});
});
describe("#849 rescheduled occurrences with PostgreSQL", () => {
  it("rearms future offsets and consumes elapsed offsets on a changed start", async () => {
    const event = await fixture();
    await db.notificationSchedule.createMany({
      data: [24, 168].map((hoursBefore) => ({
        eventId: event.id,
        hoursBefore,
        consumedAt: new Date(),
      })),
    });
    const later = new Date(Date.now() + 72 * 3600000);
    await saveEventDates(event.id, later.toISOString().slice(0, 16), null);
    const rows = await db.notificationSchedule.findMany({ where: { eventId: event.id } });
    expect(rows.find((row) => row.hoursBefore === 24)?.consumedAt).toBeNull();
    expect(rows.find((row) => row.hoursBefore === 168)?.consumedAt).toBeInstanceOf(Date);
    await saveEventDates(event.id, "2099-01-01T12:00", null);
    expect(
      await db.notificationSchedule.count({ where: { eventId: event.id, consumedAt: null } })
    ).toBe(2);
  });
  it("preserves consumed occurrences when only the end time changes", async () => {
    const event = await fixture();
    const consumedAt = new Date("2026-01-01T00:00:00Z");
    const slot = await db.notificationSchedule.create({
      data: { eventId: event.id, hoursBefore: 24, consumedAt },
    });
    await saveEventDates(event.id, "2099-01-01T12:00", "2099-01-01T14:00");
    expect(
      (await db.notificationSchedule.findUniqueOrThrow({ where: { id: slot.id } })).consumedAt
    ).toEqual(consumedAt);
  });
  it("loads and consumes only due active schedules, and sends only Going/Maybe", async () => {
    const event = await fixture();
    await db.event.update({
      where: { id: event.id },
      data: { startAt: new Date(Date.now() + 90 * 60000) },
    });
    await db.notificationSchedule.createMany({
      data: [
        { eventId: event.id, hoursBefore: 2 },
        { eventId: event.id, hoursBefore: 1 },
        { eventId: event.id, hoursBefore: 4, enabled: false },
        { eventId: event.id, hoursBefore: 24, consumedAt: new Date() },
      ],
    });
    for (const status of ["GOING", "MAYBE", "NO", "INVITED"] as const)
      await db.rSVP.create({
        data: {
          eventId: event.id,
          guestName: status,
          guestEmail: `${status}@example.test`,
          status,
          approved: true,
        },
      });
    await processReminders();
    expect(
      m.deliver.mock.calls[0][1]
        .map((r: { destinations: { email: string } }) => r.destinations.email)
        .sort()
    ).toEqual(["GOING@example.test", "MAYBE@example.test"]);
    const slots = await db.notificationSchedule.findMany({ where: { eventId: event.id } });
    expect(slots.find((row) => row.hoursBefore === 2)?.consumedAt).toBeInstanceOf(Date);
    expect(slots.find((row) => row.hoursBefore === 1)?.consumedAt).toBeNull();
    await processReminders();
    expect(m.deliver).toHaveBeenCalledTimes(1);
  });
});

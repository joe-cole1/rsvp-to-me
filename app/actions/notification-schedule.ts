"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertHostOrCohost } from "@/lib/auth-guards";
import { assertCaptcha } from "@/lib/captcha";
import { hashToken } from "@/lib/hash";
import { getRequestTranslator } from "@/i18n/server";

const PRESET_HOURS = [168, 24, 4, 2, 1];
const NUDGE_HOURS = 72;

/** pending: will send. done: consumed and never repeats. passed: its time is already over. */
export type ScheduleStatus = "pending" | "done" | "passed";

function revision(rows: { id: string; enabled: boolean; recipientRouting: boolean }[]) {
  return hashToken(
    JSON.stringify(
      rows
        .map(({ id, enabled, recipientRouting }) => ({ id, enabled, recipientRouting }))
        .sort((a, b) => a.id.localeCompare(b.id))
    )
  );
}

async function readSchedule(eventId: string) {
  const [rows, event] = await Promise.all([
    db.notificationSchedule.findMany({ where: { eventId }, orderBy: { hoursBefore: "desc" } }),
    db.event.findUniqueOrThrow({ where: { id: eventId }, select: { startAt: true } }),
  ]);
  const status = (hours: number, row?: { consumedAt: Date | null }): ScheduleStatus =>
    row?.consumedAt
      ? "done"
      : event.startAt.getTime() - hours * 3600000 <= Date.now()
        ? "passed"
        : "pending";
  const reminders = rows.filter((row) => row.kind === "reminder");
  const nudge = rows.find((row) => row.kind === "nudge");
  return {
    revision: revision(rows),
    times: [
      ...new Set([
        ...PRESET_HOURS,
        ...reminders.filter((row) => row.enabled).map((row) => row.hoursBefore),
      ]),
    ]
      .sort((a, b) => b - a)
      .map((hours) => {
        const row = reminders.find((item) => item.hoursBefore === hours);
        return { hours, enabled: !!row?.enabled, status: status(hours, row) };
      }),
    nudge: { enabled: !!nudge?.enabled, status: status(NUDGE_HOURS, nudge) },
    // Enabled occurrences that still use the limits migrated from the old per-channel settings.
    legacy: rows
      .filter((row) => row.enabled && !row.recipientRouting)
      .map((row) => ({ kind: row.kind, hours: row.hoursBefore, channels: row.legacyChannels })),
  };
}
export type NotificationScheduleData = Awaited<ReturnType<typeof readSchedule>>;

export async function getNotificationSchedule(eventId: string) {
  try {
    await assertHostOrCohost(eventId);
    return { success: true as const, data: await readSchedule(eventId) };
  } catch {
    return {
      success: false as const,
      error: (await getRequestTranslator())("Ui.Notifications.errors.loadFailed"),
    };
  }
}

export async function saveNotificationSchedule(
  eventId: string,
  raw: unknown,
  captchaToken?: string | null
) {
  const t = await getRequestTranslator();
  try {
    await assertHostOrCohost(eventId);
    await assertCaptcha("event_settings", captchaToken);
    const data = z
      .object({
        revision: z.string().length(64),
        hours: z.array(z.number().int().min(1).max(8760)).max(10),
        nudge: z.boolean(),
        convertLegacy: z.boolean().optional(),
      })
      .strict()
      .parse(raw);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`schedule:${eventId}`}, 0))`;
      const rows = await tx.notificationSchedule.findMany({ where: { eventId } });
      if (data.revision !== revision(rows)) throw new Error("settingsChanged");
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { startAt: true },
      });
      await tx.notificationSchedule.updateMany({ where: { eventId }, data: { enabled: false } });
      // Only an explicit confirmation lifts the channel limits migrated from old settings.
      if (data.convertLegacy)
        await tx.notificationSchedule.updateMany({
          where: { eventId },
          data: { recipientRouting: true },
        });
      for (const slot of [...new Set(data.hours)]
        .map((hoursBefore) => ({ kind: "reminder", hoursBefore }))
        .concat(data.nudge ? [{ kind: "nudge", hoursBefore: NUDGE_HOURS }] : [])) {
        await tx.notificationSchedule.upsert({
          where: { eventId_kind_hoursBefore: { eventId, ...slot } },
          update: { enabled: true },
          create: {
            eventId,
            ...slot,
            enabled: true,
            recipientRouting: true,
            consumedAt:
              event.startAt.getTime() - slot.hoursBefore * 3600000 <= Date.now()
                ? new Date()
                : null,
          },
        });
      }
    });
    return { success: true as const, data: await readSchedule(eventId) };
  } catch (error) {
    const key =
      error instanceof Error && error.message === "settingsChanged"
        ? "settingsChanged"
        : "saveFailed";
    return { success: false as const, error: t(`Ui.Notifications.errors.${key}`) };
  }
}

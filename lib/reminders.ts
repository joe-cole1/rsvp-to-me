import { getTranslator } from "@/i18n/server";
import { db } from "./db";
import { recipientSelect, resolveRecipients } from "./notifications/resolve";
import { deliver } from "./notifications/service";
import { isRedisEnabled, redisAcquireLock, redisReleaseLock } from "./redis";
import { logSafe } from "./logger";

/** Week and day reminders keep their natural wording; other offsets use pluralized hours. */
export function reminderCopy(kind: string, hours: number) {
  if (kind === "nudge") return ["Reminders.nudge_email", "Reminders.nudge_sms"] as const;
  if (hours === 168) return ["Reminders.email_week", "Reminders.sms_week"] as const;
  if (hours === 24) return ["Reminders.email_day", "Reminders.sms_day"] as const;
  return ["Reminders.email_hours", "Reminders.sms_hours"] as const;
}

export async function processReminders(): Promise<void> {
  const jobName = "process_reminders";
  const now = new Date();
  const expireAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes lock expiry
  const lockKey = `lock:cron:${jobName}`;

  let hasRedisLock = false;

  if (isRedisEnabled()) {
    // Acquire Redis lock for 10 minutes (600 seconds)
    const acquired = await redisAcquireLock(lockKey, 600);
    if (!acquired) {
      console.log(
        "[cron-scheduler] Failed to acquire Redis lock (another instance is running). Skipping reminders check."
      );
      return;
    }
    hasRedisLock = true;
  } else {
    // Clean up stale database locks
    await db.cronLock
      .deleteMany({
        where: { expireAt: { lt: now } },
      })
      .catch(logSafe("reminders:stale-db-lock-cleanup"));

    try {
      await db.cronLock.create({
        data: { jobName, lockedAt: now, expireAt },
      });
    } catch {
      console.log(
        "[cron-scheduler] Failed to acquire database lock (another instance is running). Skipping reminders check."
      );
      return;
    }
  }

  try {
    // Clean up expired sessions during the cron run
    await db.session
      .deleteMany({
        where: { expiresAt: { lt: now } },
      })
      .catch(logSafe("reminders:expired-session-cleanup"));

    const schedules = await db.notificationSchedule.findMany({
      where: {
        enabled: true,
        consumedAt: null,
        event: { status: { notIn: ["CANCELLED", "DELETED"] }, startAt: { gt: now } },
      },
      include: {
        event: {
          include: {
            theme: true,
            host: { select: { name: true } },
            rsvps: {
              where: { approved: true },
              select: { ...recipientSelect, status: true, responded: true },
            },
            invitations: { select: { rsvpId: true, channel: true, sentTo: true } },
          },
        },
      },
    });
    for (const schedule of schedules) {
      const { event } = schedule;
      if (now.getTime() < event.startAt.getTime() - schedule.hoursBefore * 3600000) continue;
      // Consume before submission: uncertainty or partial success must never auto-repeat.
      const claimed = await db.notificationSchedule.updateMany({
        where: { id: schedule.id, enabled: true, consumedAt: null },
        data: { consumedAt: now },
      });
      if (!claimed.count) continue;
      try {
        const rows =
          schedule.kind === "nudge"
            ? event.rsvps
                .filter((row) => row.status === "INVITED" && !row.responded)
                .map((row) => ({
                  ...row,
                  guestEmail: event.invitations.some(
                    (invite) =>
                      invite.rsvpId === row.id &&
                      invite.channel === "EMAIL" &&
                      invite.sentTo.toLowerCase().trim() === row.guestEmail?.toLowerCase().trim()
                  )
                    ? row.guestEmail
                    : null,
                  guestPhone: event.invitations.some(
                    (invite) =>
                      invite.rsvpId === row.id &&
                      invite.channel === "SMS" &&
                      invite.sentTo === row.guestPhone
                  )
                    ? row.guestPhone
                    : null,
                }))
            : event.rsvps;
        const recipients = await resolveRecipients(
          "reminders",
          rows,
          schedule.recipientRouting ? undefined : schedule.legacyChannels
        );
        const [emailKey, smsKey] = reminderCopy(schedule.kind, schedule.hoursBefore);
        // Render copy per locale without treating host content as ICU syntax.
        for (const locale of new Set(recipients.map((recipient) => recipient.locale))) {
          const t = await getTranslator(locale);
          const values = { eventTitle: event.title, hours: schedule.hoursBefore };
          await deliver(
            {
              kind: "event_update",
              id: schedule.id,
              eventTitle: event.title,
              eventSlug: event.slug,
              hostName: event.hostDisplayName ?? event.host.name,
              theme: event.theme,
              body: t(emailKey, values),
              smsBody: t(smsKey, values),
            },
            recipients.filter((recipient) => recipient.locale === locale)
          );
        }
      } catch {
        console.warn("[reminders] Occurrence consumed; notification preparation failed");
      }
    }
  } finally {
    // Release the lock
    if (hasRedisLock) {
      await redisReleaseLock(lockKey).catch(logSafe("reminders:release-redis-lock"));
    } else {
      await db.cronLock.delete({ where: { jobName } }).catch(logSafe("reminders:release-db-lock"));
    }
  }
}

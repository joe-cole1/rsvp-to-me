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

  let redisLockToken: string | null = null;

  if (isRedisEnabled()) {
    // Acquire Redis lock for 10 minutes (600 seconds)
    const acquired = await redisAcquireLock(lockKey, 600);
    if (!acquired) {
      console.log(
        "[cron-scheduler] Failed to acquire Redis lock (another instance is running). Skipping reminders check."
      );
      return;
    }
    redisLockToken = acquired;
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

    // Resolve due occurrences in PostgreSQL before loading any guest/contact data.
    const due = await db.$queryRaw<{ id: string; eventId: string; startAt: Date }[]>`
      SELECT s.id, s."eventId", e."startAt"
      FROM "NotificationSchedule" s JOIN "Event" e ON e.id = s."eventId"
      WHERE s.enabled = true AND s."consumedAt" IS NULL
        AND e."rsvpEnabled" = true
        AND e.status NOT IN ('CANCELLED', 'DELETED') AND e."startAt" > ${now}
        AND e."startAt" - s."hoursBefore" * INTERVAL '1 hour' <= ${now}
    `;
    for (const candidate of due) {
      const schedule = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`schedule:${candidate.eventId}`}, 0))`;
        // Recheck the date and due time under the date editor's lock. Consume before
        // submission: uncertainty or partial success must never auto-repeat.
        const claimed = await tx.$executeRaw`
          UPDATE "NotificationSchedule" s SET "consumedAt" = ${now}
          FROM "Event" e WHERE s.id = ${candidate.id} AND e.id = s."eventId"
            AND s.enabled = true AND s."consumedAt" IS NULL
            AND e."rsvpEnabled" = true
            AND e."startAt" = ${candidate.startAt}
            AND e.status NOT IN ('CANCELLED', 'DELETED') AND e."startAt" > ${now}
            AND e."startAt" - s."hoursBefore" * INTERVAL '1 hour' <= ${now}
        `;
        if (!claimed) return null;
        return tx.notificationSchedule.findUniqueOrThrow({
          where: { id: candidate.id },
          include: {
            event: {
              include: {
                theme: true,
                host: { select: { name: true } },
                rsvps: {
                  where: { approved: true, status: { in: ["GOING", "MAYBE", "INVITED"] } },
                  select: { ...recipientSelect, status: true, responded: true },
                },
                invitations: { select: { rsvpId: true, channel: true, sentTo: true } },
              },
            },
          },
        });
      });
      if (!schedule) continue;
      const { event } = schedule;
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
            : event.rsvps.filter((row) => row.status === "GOING" || row.status === "MAYBE");
        const recipients = await resolveRecipients(
          "reminders",
          rows,
          schedule.recipientRouting ? undefined : schedule.legacyChannels
        );
        // Recheck the event date immediately before provider submission as well.
        // A request already in flight cannot be recalled by a date edit.
        for (const recipient of recipients) {
          const canSend = recipient.canSend;
          recipient.canSend = async (channel, destination) => {
            const current = await db.event.findUnique({
              where: { id: event.id },
              select: { startAt: true, status: true, rsvpEnabled: true },
            });
            return (
              !!current &&
              current.rsvpEnabled !== false &&
              current.startAt.getTime() === event.startAt.getTime() &&
              current.startAt.getTime() > Date.now() &&
              !["CANCELLED", "DELETED"].includes(current.status) &&
              (!canSend || (await canSend(channel, destination)))
            );
          };
        }
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
    if (redisLockToken) {
      await redisReleaseLock(lockKey, redisLockToken).catch(
        logSafe("reminders:release-redis-lock")
      );
    } else {
      await db.cronLock
        .deleteMany({ where: { jobName, lockedAt: now, expireAt } })
        .catch(logSafe("reminders:release-db-lock"));
    }
  }
}

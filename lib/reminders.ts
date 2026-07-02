import { db } from "./db";
import { sendBlastEmail } from "./email";
import { sendSmsBlast } from "./sms";
import { isRedisEnabled, redisAcquireLock, redisReleaseLock } from "./redis";
import { logSafe } from "./logger";

type ReminderType =
  | "email_week"
  | "email_day"
  | "email_hours"
  | "sms_week"
  | "sms_day"
  | "sms_hours"
  | "nudge_email"
  | "nudge_sms";

function hoursLabel(n: number) {
  return n === 1 ? "1 hour" : `${n} hours`;
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

    const events = await db.event.findMany({
      where: {
        status: { not: "CANCELLED" },
        startAt: { gt: now },
        reminderSettings: { isNot: null },
      },
      include: {
        reminderSettings: true,
        host: { select: { name: true } },
        rsvps: {
          where: { approved: true },
          select: {
            guestEmail: true,
            guestPhone: true,
            status: true,
            user: {
              select: {
                emailNotifications: true,
                smsNotifications: true,
              },
            },
          },
        },
        sentReminders: { select: { type: true } },
      },
    });

    for (const event of events) {
      const rs = event.reminderSettings!;
      const sent = new Set(event.sentReminders.map((r) => r.type));
      const startAt = event.startAt;

      const emails = event.rsvps.flatMap((r) => {
        if (!r.guestEmail) return [];
        if (r.user && !r.user.emailNotifications) return [];
        return [r.guestEmail];
      });
      const phones = event.rsvps.flatMap((r) => {
        if (!r.guestPhone) return [];
        if (r.user && !r.user.smsNotifications) return [];
        return [r.guestPhone];
      });
      const rsvpEmails = new Set(emails);
      const rsvpPhones = new Set(phones);

      const hostName = event.host.name ?? "Your host";
      const base = { eventTitle: event.title, eventSlug: event.slug, hostName };

      const checks: Array<{
        type: ReminderType;
        enabled: boolean;
        dueAt: Date;
        send: () => Promise<unknown>;
      }> = [
        {
          type: "email_week",
          enabled: rs.emailWeekBefore && emails.length > 0,
          dueAt: new Date(startAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          send: () =>
            sendBlastEmail(emails, {
              ...base,
              message: `Just a reminder — ${event.title} is one week away! We can't wait to see you.`,
            }),
        },
        {
          type: "email_day",
          enabled: rs.emailDayBefore && emails.length > 0,
          dueAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
          send: () =>
            sendBlastEmail(emails, {
              ...base,
              message: `${event.title} is tomorrow! See you then.`,
            }),
        },
        {
          type: "email_hours",
          enabled: rs.emailHoursBefore > 0 && emails.length > 0,
          dueAt: new Date(startAt.getTime() - rs.emailHoursBefore * 60 * 60 * 1000),
          send: () =>
            sendBlastEmail(emails, {
              ...base,
              message: `${event.title} starts in ${hoursLabel(rs.emailHoursBefore)}! See you soon.`,
            }),
        },
        {
          type: "sms_week",
          enabled: rs.smsWeekBefore && phones.length > 0,
          dueAt: new Date(startAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          send: () =>
            sendSmsBlast(phones, { ...base, message: `${event.title} is one week away!` }),
        },
        {
          type: "sms_day",
          enabled: rs.smsDayBefore && phones.length > 0,
          dueAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
          send: () =>
            sendSmsBlast(phones, { ...base, message: `${event.title} is tomorrow! See you then.` }),
        },
        {
          type: "sms_hours",
          enabled: rs.smsHoursBefore > 0 && phones.length > 0,
          dueAt: new Date(startAt.getTime() - rs.smsHoursBefore * 60 * 60 * 1000),
          send: () =>
            sendSmsBlast(phones, {
              ...base,
              message: `${event.title} starts in ${hoursLabel(rs.smsHoursBefore)}!`,
            }),
        },
        {
          type: "nudge_email",
          enabled: rs.nudgeUnresponded,
          dueAt: new Date(startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
          send: async () => {
            const invitations = await db.invitation.findMany({
              where: { eventId: event.id, channel: "EMAIL" },
              select: { sentTo: true },
            });
            const nudgeEmails = [...new Set(invitations.map((i) => i.sentTo))].filter(
              (e) => !rsvpEmails.has(e)
            );
            if (nudgeEmails.length === 0) return;
            return sendBlastEmail(nudgeEmails, {
              ...base,
              message: `You're invited to ${event.title} in 3 days — have you had a chance to RSVP?`,
            });
          },
        },
        {
          type: "nudge_sms",
          enabled: rs.nudgeUnresponded,
          dueAt: new Date(startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
          send: async () => {
            const invitations = await db.invitation.findMany({
              where: { eventId: event.id, channel: "SMS" },
              select: { sentTo: true },
            });
            const nudgePhones = [...new Set(invitations.map((i) => i.sentTo))].filter(
              (p) => !rsvpPhones.has(p)
            );
            if (nudgePhones.length === 0) return;
            return sendSmsBlast(nudgePhones, {
              ...base,
              message: `${event.title} is in 3 days — have you had a chance to RSVP?`,
            });
          },
        },
      ];

      for (const check of checks) {
        if (!check.enabled || sent.has(check.type) || now < check.dueAt) continue;

        try {
          await check.send();
          await db.sentReminder.create({ data: { eventId: event.id, type: check.type } });
          console.log(`[reminders] Sent ${check.type} for "${event.title}"`);
        } catch (err) {
          console.error(`[reminders] Failed ${check.type} for "${event.title}":`, err);
        }
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

import { db } from "./db";
import { sendBlastEmail } from "./email";
import { sendSmsBlast } from "./sms";

type ReminderType =
  | "email_week"
  | "email_day"
  | "email_hours"
  | "sms_week"
  | "sms_day"
  | "sms_hours"
  | "nudge_email";

function hoursLabel(n: number) {
  return n === 1 ? "1 hour" : `${n} hours`;
}

export async function processReminders(): Promise<void> {
  const now = new Date();

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
        select: { guestEmail: true, guestPhone: true, status: true },
      },
      sentReminders: { select: { type: true } },
    },
  });

  for (const event of events) {
    const rs = event.reminderSettings!;
    const sent = new Set(event.sentReminders.map((r) => r.type));
    const startAt = event.startAt;

    const emails = event.rsvps.flatMap((r) => (r.guestEmail ? [r.guestEmail] : []));
    const phones = event.rsvps.flatMap((r) => (r.guestPhone ? [r.guestPhone] : []));
    const maybeEmails = event.rsvps
      .filter((r) => r.status === "MAYBE")
      .flatMap((r) => (r.guestEmail ? [r.guestEmail] : []));

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
        enabled: rs.nudgeUnresponded && maybeEmails.length > 0,
        dueAt: new Date(startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
        send: () =>
          sendBlastEmail(maybeEmails, {
            ...base,
            message: `Still on the fence for ${event.title}? It's in 3 days — let us know if you can make it!`,
          }),
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
}

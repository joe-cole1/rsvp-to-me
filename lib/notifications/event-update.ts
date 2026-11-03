import { db } from "@/lib/db";
import { createEmailNotificationAdapter } from "@/lib/email";
import { createSmsNotificationAdapter } from "@/lib/sms";
import { dispatchNotification } from "./dispatch";
import { resolveUpdateRecipients } from "./recipients";
import type { DeliverySummary } from "./types";

/** The event domain owns audience selection; transports never query guest identity. */
export async function notifyEventUpdate(
  eventId: string,
  eventSlug: string,
  updateId: string,
  body: string
): Promise<DeliverySummary> {
  const rows = await db.rSVP.findMany({
    where: { eventId, OR: [{ guestEmail: { not: null } }, { guestPhone: { not: null } }] },
    select: {
      id: true,
      guestEmail: true,
      guestPhone: true,
      user: {
        select: {
          notificationChannel: true,
          emailNotifications: true,
          smsNotifications: true,
          preferredLocale: true,
        },
      },
    },
  });
  if (!rows.length) return { accepted: 0, skipped: 0, failed: 0, uncertain: 0 };
  const recipients = resolveUpdateRecipients(rows);
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      theme: true,
      hostDisplayName: true,
      host: { select: { name: true, email: true } },
    },
  });
  if (!event) throw new Error("Notification event unavailable");
  const adapters = await Promise.all([
    createEmailNotificationAdapter(),
    createSmsNotificationAdapter(),
  ]);
  const report = await dispatchNotification(
    {
      kind: "event_update",
      id: updateId,
      eventSlug,
      eventTitle: event.title,
      body,
      hostName: event.hostDisplayName ?? event.host.name,
      replyTo: event.host.email || undefined,
      theme: event.theme,
    },
    recipients,
    adapters
  );
  return report.summary;
}

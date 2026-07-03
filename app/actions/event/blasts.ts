"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendBlastEmail } from "@/lib/email";
import { sendSmsBlast as smsSendBlast } from "@/lib/sms";
import { logSafe } from "@/lib/logger";
import { buildRsvpStatusFilter, type BlastStatusFilter } from "@/lib/blastFilters";
import { assertHostOrCohost } from "./shared";

// ── Message blast ──────────────────────────────────────────────────────────────

export async function sendBlast(eventId: string, message: string, filters: BlastStatusFilter[]) {
  await assertHostOrCohost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, theme: true, host: { select: { name: true, email: true } } },
  });
  if (!event) throw new Error("Event not found");

  const whereStatus = buildRsvpStatusFilter(filters);

  const rsvps = await db.rSVP.findMany({
    where: { eventId, guestEmail: { not: null }, ...whereStatus },
    select: { guestEmail: true },
  });

  const emails = rsvps.flatMap((r: { guestEmail: string | null }) =>
    r.guestEmail ? [r.guestEmail] : []
  );
  if (emails.length === 0) return { success: true, sent: 0 };

  await sendBlastEmail(emails, {
    eventTitle: event.title,
    eventSlug: event.slug,
    message,
    hostName: event.host.name ?? "Your host",
    theme: event.theme,
    replyTo: event.host.email || undefined,
  });

  db.invitation
    .createMany({
      data: emails.map((sentTo) => ({ eventId, sentTo, channel: "EMAIL" as const })),
    })
    .catch(logSafe("sendBlast"));

  return { success: true, sent: emails.length };
}

export async function sendSmsBlast(eventId: string, message: string, filters: BlastStatusFilter[]) {
  await assertHostOrCohost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error("Event not found");

  const whereStatus = buildRsvpStatusFilter(filters);

  const rsvps = await db.rSVP.findMany({
    where: { eventId, guestPhone: { not: null }, ...whereStatus },
    select: { guestPhone: true },
  });

  const phones = rsvps.flatMap((r: { guestPhone: string | null }) =>
    r.guestPhone ? [r.guestPhone] : []
  );
  if (phones.length === 0) return { success: true, sent: 0 };

  const sent = await smsSendBlast(phones, {
    eventTitle: event.title,
    eventSlug: event.slug,
    message,
    hostName: event.host.name ?? "Your host",
  });

  db.invitation
    .createMany({
      data: phones.map((sentTo) => ({ eventId, sentTo, channel: "SMS" as const })),
    })
    .catch(logSafe("sendSmsBlast"));

  return { success: true, sent };
}

// ── Event updates ─────────────────────────────────────────────────────────────

export async function addEventUpdate(eventId: string, body: string, notifyGuests: boolean) {
  const event = await assertHostOrCohost(eventId);
  const update = await db.eventUpdate.create({ data: { eventId, body, notifyGuests } });
  if (notifyGuests) {
    const rsvps = await db.rSVP.findMany({
      where: {
        eventId,
        OR: [{ guestEmail: { not: null } }, { guestPhone: { not: null } }],
      },
      select: {
        guestEmail: true,
        guestPhone: true,
        user: { select: { notificationChannel: true } },
      },
    });

    const emailGuests: string[] = [];
    const smsGuests: string[] = [];

    for (const r of rsvps) {
      const channel = r.user?.notificationChannel ?? "EMAIL";
      if (channel === "SMS" && r.guestPhone) {
        smsGuests.push(r.guestPhone);
      } else if (r.guestEmail) {
        emailGuests.push(r.guestEmail);
      }
    }

    if (emailGuests.length > 0 || smsGuests.length > 0) {
      const fullEvent = await db.event.findUnique({
        where: { id: eventId },
        select: { title: true, theme: true, host: { select: { name: true, email: true } } },
      });
      const eventTitle = fullEvent?.title ?? event.slug;
      const hostName = fullEvent?.host?.name ?? "Your host";
      const replyTo = fullEvent?.host?.email || undefined;

      if (emailGuests.length > 0) {
        sendBlastEmail(emailGuests, {
          eventTitle,
          eventSlug: event.slug,
          message: body,
          hostName,
          theme: fullEvent?.theme,
          replyTo,
        }).catch(logSafe("addEventUpdate"));
      }
      if (smsGuests.length > 0) {
        smsSendBlast(smsGuests, {
          eventTitle,
          eventSlug: event.slug,
          message: body,
          hostName,
        }).catch(logSafe("addEventUpdate"));
      }
    }
  }
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: update.id, createdAt: update.createdAt };
}

export async function deleteEventUpdate(updateId: string) {
  const update = await db.eventUpdate.findUnique({
    where: { id: updateId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!update) throw new Error("Forbidden");
  await assertHostOrCohost(update.eventId);
  await db.eventUpdate.delete({ where: { id: updateId } });
  revalidatePath(`/e/${update.event.slug}`);
}

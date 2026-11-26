"use server";

import { eventActionMessage } from "./localization";

import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createEmailNotificationAdapter } from "@/lib/email";
import { createSmsNotificationAdapter } from "@/lib/sms";
import { logger } from "@/lib/logger";
import { notifyEventUpdate } from "@/lib/notifications/event-update";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { recipientSelect, resolveRecipients } from "@/lib/notifications/resolve";
import type { DeliverySummary, NotificationFeedback } from "@/lib/notifications/types";
import type { Channel } from "@/lib/notifications/preferences";
import { buildRsvpStatusFilter, type BlastStatusFilter } from "@/lib/blastFilters";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";

// Hosts and co-hosts share the event quota; selecting both channels uses one of each.
async function validateBlast(eventId: string, channel: "email" | "sms", message: string) {
  if (
    !z
      .string()
      .min(1)
      .max(10000)
      .refine((value) => value.trim().length > 0)
      .safeParse(message).success
  ) {
    throw new Error(await eventActionMessage("invalidBlastMessage"));
  }
  if (!(await rateLimit(`blast:${eventId}:${channel}`, 10, 3600)).success) {
    throw new Error(await eventActionMessage("blastRateLimited"));
  }
}

// ── Message blast ──────────────────────────────────────────────────────────────

export async function sendBlast(
  eventId: string,
  message: string,
  filters: BlastStatusFilter[],
  captchaToken?: string | null
) {
  return sendManualBlast(eventId, message, filters, "email", captchaToken);
}

export async function sendSmsBlast(
  eventId: string,
  message: string,
  filters: BlastStatusFilter[],
  captchaToken?: string | null
) {
  return sendManualBlast(eventId, message, filters, "sms", captchaToken);
}

async function sendManualBlast(
  eventId: string,
  message: string,
  filters: BlastStatusFilter[],
  channel: Channel,
  captchaToken?: string | null
) {
  await assertHostOrCohost(eventId);
  await assertCaptcha("message_send", captchaToken);
  await validateBlast(eventId, channel, message);

  const summary: DeliverySummary = { accepted: 0, skipped: 0, failed: 0, uncertain: 0 };
  try {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        slug: true,
        rsvpEnabled: true,
        theme: true,
        hostDisplayName: true,
        host: { select: { name: true, email: true } },
      },
    });
    if (!event) throw new Error("Blast event unavailable");
    if (event.rsvpEnabled === false) {
      return { success: false, sent: 0, summary };
    }
    const adapter =
      channel === "email"
        ? await createEmailNotificationAdapter()
        : await createSmsNotificationAdapter();
    const CHUNK_SIZE = 500;
    for (let skip = 0; ; skip += CHUNK_SIZE) {
      const rsvps = await db.rSVP.findMany({
        where: {
          eventId,
          ...(channel === "email" ? { guestEmail: { not: null } } : { guestPhone: { not: null } }),
          ...buildRsvpStatusFilter(filters),
        },
        select: recipientSelect,
        take: CHUNK_SIZE,
        skip,
        orderBy: { id: "asc" },
      });
      if (!rsvps.length) break;
      // Manual host messages are event updates. A host's channel selection is a ceiling,
      // never permission to override the guest's event/profile choices or contact state.
      const recipients = await resolveRecipients("updates", rsvps, [channel]);
      const report = await dispatchNotification(
        {
          kind: "event_update",
          id: crypto.randomUUID(),
          eventSlug: event.slug,
          eventTitle: event.title,
          body: message,
          hostName: event.hostDisplayName ?? event.host.name,
          replyTo: event.host.email || undefined,
          theme: event.theme,
        },
        recipients,
        [adapter]
      );
      for (const status of ["accepted", "skipped", "failed", "uncertain"] as const) {
        summary[status] += report.summary[status];
      }
      if (rsvps.length < CHUNK_SIZE) break;
    }
  } catch {
    // Preserve completed chunks, but never expose private preparation/provider errors.
    logger.warn("Manual-blast notification processing failed", { eventId, channel });
    return { success: false, sent: summary.accepted, summary };
  }
  return { success: true, sent: summary.accepted, summary };
}

// ── Event updates ─────────────────────────────────────────────────────────────

export async function addEventUpdate(
  eventId: string,
  body: string,
  notifyGuests: boolean,
  captchaToken?: string | null
) {
  const event = await assertHostOrCohost(eventId);
  await assertCaptcha("event_update", captchaToken);
  const effectiveNotify = event.rsvpEnabled === false ? false : notifyGuests;
  const update = await db.eventUpdate.create({
    data: { eventId, body, notifyGuests: effectiveNotify },
  });
  let notifications: NotificationFeedback = null;
  if (effectiveNotify) {
    try {
      notifications = {
        status: "completed",
        summary: await notifyEventUpdate(eventId, event.slug, update.id, body),
      };
    } catch {
      // Preparation errors can include private DB/provider values. Never return
      // them to the client or let notification failure undo a posted update.
      logger.warn("Event-update notification processing failed", { updateId: update.id });
      notifications = { status: "failed" };
    }
  }
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: update.id, createdAt: update.createdAt, notifications };
}

export async function deleteEventUpdate(updateId: string) {
  const update = await db.eventUpdate.findUnique({
    where: { id: updateId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!update) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(update.eventId);
  await db.eventUpdate.delete({ where: { id: updateId } });
  revalidatePath(`/e/${update.event.slug}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendRsvpConfirmationEmail, sendBlastEmail } from "@/lib/email";
import { sendRsvpConfirmationSms, sendSmsBlast as smsSendBlast } from "@/lib/sms";
import type { BaseTheme } from "@/lib/theme";

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function assertHost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({ where: { id: eventId }, select: { hostId: true, slug: true } });
  if (!event || event.hostId !== session.userId) throw new Error("Forbidden");
  return event;
}

// ── Inline field edits ─────────────────────────────────────────────────────────

const ALLOWED_FIELDS = new Set(["title", "description", "locationName", "locationAddress", "virtualUrl"]);

export async function saveEventField(eventId: string, field: string, value: string) {
  if (!ALLOWED_FIELDS.has(field)) throw new Error("Field not allowed");
  const event = await assertHost(eventId);
  await db.event.update({ where: { id: eventId }, data: { [field]: value || null } });
  revalidatePath(`/e/${event.slug}`);
}

// ── Location ───────────────────────────────────────────────────────────────────

export async function saveEventLocation(
  eventId: string,
  data: {
    locationType: "PHYSICAL" | "VIRTUAL" | "TBD";
    locationName: string | null;
    locationAddress: string | null;
    virtualUrl: string | null;
  }
) {
  const event = await assertHost(eventId);
  await db.event.update({
    where: { id: eventId },
    data: {
      locationType: data.locationType,
      locationName: data.locationName || null,
      locationAddress: data.locationAddress || null,
      virtualUrl: data.virtualUrl || null,
    },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── Theme ──────────────────────────────────────────────────────────────────────

export async function saveEventTheme(eventId: string, baseTheme: BaseTheme, accentColor: string) {
  const event = await assertHost(eventId);
  await db.eventTheme.upsert({
    where: { eventId },
    update: { baseTheme, accentColor },
    create: { eventId, baseTheme, accentColor },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── Info sections ──────────────────────────────────────────────────────────────

export async function addInfoSection(data: {
  eventId: string;
  type: string;
  title: string | null;
  content: string;
  url: string | null;
  order: number;
}) {
  const event = await assertHost(data.eventId);
  const section = await db.eventInfoSection.create({
    data: {
      eventId: data.eventId,
      type: data.type as "DRESS_CODE" | "FOOD" | "PARKING" | "LINK" | "CUSTOM",
      title: data.title,
      content: data.content,
      url: data.url,
      order: data.order,
    },
  });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: section.id };
}

export async function removeInfoSection(sectionId: string) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!section || section.event.hostId !== session?.userId) throw new Error("Forbidden");
  await db.eventInfoSection.delete({ where: { id: sectionId } });
  revalidatePath(`/e/${section.event.slug}`);
}

// ── RSVP ──────────────────────────────────────────────────────────────────────

export async function addRSVP(data: {
  eventId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
  note?: string;
}) {
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: { id: true, slug: true, title: true, approvalRequired: true, rsvpDeadline: true, capacity: true, startAt: true, locationName: true, host: { select: { name: true } } },
  });
  if (!event) return { success: false, error: "Event not found" };
  if (event.rsvpDeadline && event.rsvpDeadline < new Date()) return { success: false, error: "RSVP deadline has passed" };

  // Check capacity
  if (event.capacity && data.status === "GOING") {
    const goingCount = await db.rSVP.count({ where: { eventId: data.eventId, status: "GOING", approved: true } });
    if (goingCount >= event.capacity) return { success: false, error: "Event is at capacity" };
  }

  const rsvp = await db.rSVP.create({
    data: {
      eventId: data.eventId,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      status: data.status,
      plusOneCount: data.plusOneCount,
      note: data.note || null,
      approved: !event.approvalRequired,
    },
  });

  if (data.guestEmail) {
    sendRsvpConfirmationEmail(data.guestEmail, {
      guestName: data.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      status: data.status,
      editToken: rsvp.editToken,
      startAt: event.startAt,
      locationName: event.locationName,
    }).catch(() => {});
  }
  if (data.guestPhone) {
    sendRsvpConfirmationSms(data.guestPhone, {
      guestName: data.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      status: data.status,
      editToken: rsvp.editToken,
    }).catch(() => {});
  }

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: rsvp.id, editToken: rsvp.editToken };
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(data: {
  eventId: string;
  guestName: string;
  body: string;
  parentId?: string;
}) {
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: { slug: true, commentsEnabled: true },
  });
  if (!event?.commentsEnabled) return { success: false, error: "Comments disabled" };

  const comment = await db.comment.create({
    data: {
      eventId: data.eventId,
      guestName: data.guestName,
      body: data.body,
      parentId: data.parentId,
    },
  });

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: comment.id };
}

// ── Event settings ─────────────────────────────────────────────────────────────

export async function saveEventSettings(
  eventId: string,
  settings: {
    commentsEnabled?: boolean;
    plusOneAllowed?: boolean;
    plusOneMax?: number;
    approvalRequired?: boolean;
    rsvpDeadline?: string | null;
    capacity?: number | null;
    guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
    visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  }
) {
  const event = await assertHost(eventId);
  await db.event.update({
    where: { id: eventId },
    data: {
      ...settings,
      rsvpDeadline: settings.rsvpDeadline ? new Date(settings.rsvpDeadline) : settings.rsvpDeadline === null ? null : undefined,
    },
  });
  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/settings`);
}

// ── RSVP edit (guest) ─────────────────────────────────────────────────────────

export async function updateRSVP(
  editToken: string,
  data: { status: "GOING" | "MAYBE" | "NO"; plusOneCount: number; note?: string }
) {
  const rsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: { event: { select: { slug: true } } },
  });
  if (!rsvp) return { success: false, error: "RSVP not found" };

  await db.rSVP.update({
    where: { editToken },
    data: { status: data.status, plusOneCount: data.plusOneCount, note: data.note ?? undefined },
  });

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

// ── Message blast ──────────────────────────────────────────────────────────────

export async function sendBlast(
  eventId: string,
  message: string,
  filter: "ALL" | "GOING" | "MAYBE"
) {
  await assertHost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error("Event not found");

  const whereStatus = filter === "ALL" ? {} : { status: filter };
  const rsvps = await db.rSVP.findMany({
    where: { eventId, guestEmail: { not: null }, ...whereStatus },
    select: { guestEmail: true },
  });

  const emails = rsvps.flatMap((r: { guestEmail: string | null }) => r.guestEmail ? [r.guestEmail] : []);
  if (emails.length === 0) return { success: true, sent: 0 };

  await sendBlastEmail(emails, {
    eventTitle: event.title,
    eventSlug: event.slug,
    message,
    hostName: event.host.name ?? "Your host",
  });

  return { success: true, sent: emails.length };
}

export async function sendSmsBlast(
  eventId: string,
  message: string,
  filter: "ALL" | "GOING" | "MAYBE"
) {
  await assertHost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error("Event not found");

  const whereStatus = filter === "ALL" ? {} : { status: filter };
  const rsvps = await db.rSVP.findMany({
    where: { eventId, guestPhone: { not: null }, ...whereStatus },
    select: { guestPhone: true },
  });

  const phones = rsvps.flatMap((r: { guestPhone: string | null }) => r.guestPhone ? [r.guestPhone] : []);
  if (phones.length === 0) return { success: true, sent: 0 };

  const sent = await smsSendBlast(phones, {
    eventTitle: event.title,
    eventSlug: event.slug,
    message,
    hostName: event.host.name ?? "Your host",
  });

  return { success: true, sent };
}

// ── Date/time edit ─────────────────────────────────────────────────────────────

function tzLocalToUtc(localStr: string, tz: string): Date {
  // localStr: "YYYY-MM-DDTHH:MM" treated as a wall-clock time in timezone tz
  // Converts to the corresponding UTC Date using the 2x trick.
  const asIfUtc = new Date(localStr + ":00Z");
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asIfUtc)) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  const localAsUtc = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}Z`
  );
  return new Date(2 * asIfUtc.getTime() - localAsUtc.getTime());
}

export async function saveEventDates(
  eventId: string,
  startAt: string,   // "YYYY-MM-DDTHH:MM" in the event's timezone
  endAt: string | null,
) {
  const event = await assertHost(eventId);
  const evt = await db.event.findUnique({ where: { id: eventId }, select: { timezone: true } });
  if (!evt) throw new Error("Event not found");
  await db.event.update({
    where: { id: eventId },
    data: {
      startAt: tzLocalToUtc(startAt, evt.timezone),
      endAt: endAt ? tzLocalToUtc(endAt, evt.timezone) : null,
    },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── Cover image ────────────────────────────────────────────────────────────────

export async function saveCoverImage(eventId: string, url: string) {
  const event = await assertHost(eventId);
  await db.eventTheme.upsert({
    where: { eventId },
    update: { coverImageUrl: url },
    create: { eventId, coverImageUrl: url },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── RSVP approval ─────────────────────────────────────────────────────────────

export async function approveRsvp(rsvpId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: { select: { hostId: true, slug: true } } },
  });
  if (!rsvp || rsvp.event.hostId !== session.userId) throw new Error("Forbidden");
  await db.rSVP.update({ where: { id: rsvpId }, data: { approved: true } });
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function declineRsvp(rsvpId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: { select: { hostId: true, slug: true } } },
  });
  if (!rsvp || rsvp.event.hostId !== session.userId) throw new Error("Forbidden");
  await db.rSVP.delete({ where: { id: rsvpId } });
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function saveReminderSettings(
  eventId: string,
  settings: {
    emailWeekBefore: boolean;
    emailDayBefore: boolean;
    emailHoursBefore: number;
    smsWeekBefore: boolean;
    smsDayBefore: boolean;
    smsHoursBefore: number;
    nudgeUnresponded: boolean;
    postEventPrompt: boolean;
  }
) {
  const event = await assertHost(eventId);
  await db.eventReminderSettings.upsert({
    where: { eventId },
    update: settings,
    create: { eventId, ...settings },
  });
  revalidatePath(`/e/${event.slug}/settings`);
}

// ── Event updates ─────────────────────────────────────────────────────────────

export async function addEventUpdate(eventId: string, body: string, notifyGuests: boolean) {
  const event = await assertHost(eventId);
  const update = await db.eventUpdate.create({ data: { eventId, body, notifyGuests } });
  if (notifyGuests) {
    const rsvps = await db.rSVP.findMany({
      where: { eventId, guestEmail: { not: null } },
      select: { guestEmail: true },
    });
    const emails = rsvps.flatMap((r: { guestEmail: string | null }) => r.guestEmail ? [r.guestEmail] : []);
    if (emails.length > 0) {
      const fullEvent = await db.event.findUnique({
        where: { id: eventId },
        select: { title: true, host: { select: { name: true } } },
      });
      sendBlastEmail(emails, {
        eventTitle: fullEvent?.title ?? event.slug,
        eventSlug: event.slug,
        message: body,
        hostName: fullEvent?.host.name ?? "Your host",
      }).catch(() => {});
    }
  }
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: update.id, createdAt: update.createdAt };
}

export async function deleteEventUpdate(updateId: string) {
  const update = await db.eventUpdate.findUnique({
    where: { id: updateId },
    select: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!update || update.event.hostId !== session?.userId) throw new Error("Forbidden");
  await db.eventUpdate.delete({ where: { id: updateId } });
  revalidatePath(`/e/${update.event.slug}`);
}

// ── Potluck ───────────────────────────────────────────────────────────────────

export async function addPotluckItem(eventId: string, label: string) {
  const event = await assertHost(eventId);
  const item = await db.potluckItem.create({ data: { eventId, label } });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: item.id };
}

export async function removePotluckItem(itemId: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!item || item.event.hostId !== session?.userId) throw new Error("Forbidden");
  await db.potluckItem.delete({ where: { id: itemId } });
  revalidatePath(`/e/${item.event.slug}`);
}

export async function claimPotluckItem(itemId: string, guestName: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { claimedBy: true, event: { select: { slug: true } } },
  });
  if (!item) return { success: false, error: "Item not found" };
  if (item.claimedBy) return { success: false, error: "Already claimed" };
  await db.potluckItem.update({
    where: { id: itemId },
    data: { claimedBy: guestName, claimedAt: new Date() },
  });
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true };
}

export async function unclaimPotluckItem(itemId: string, guestName: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { claimedBy: true, event: { select: { slug: true } } },
  });
  if (!item || item.claimedBy !== guestName) return { success: false, error: "Not your claim" };
  await db.potluckItem.update({
    where: { id: itemId },
    data: { claimedBy: null, claimedAt: null },
  });
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true };
}

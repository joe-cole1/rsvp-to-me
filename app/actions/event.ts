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

async function assertHostOrCohost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, slug: true, coHosts: { select: { userId: true } } },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isCohost = event.coHosts.some((ch: { userId: string }) => ch.userId === session.userId);
  if (!isOwner && !isCohost) throw new Error("Forbidden");
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
      type: data.type,
      title: data.title,
      content: data.content,
      url: data.url,
      order: data.order,
    },
  });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: section.id };
}

export async function updateInfoSection(
  sectionId: string,
  data: { type?: string; title?: string | null; content: string; url: string | null }
) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!section || section.event.hostId !== session?.userId) throw new Error("Forbidden");
  await db.eventInfoSection.update({
    where: { id: sectionId },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      title: null,
      content: data.content,
      url: data.url || null,
    },
  });
  revalidatePath(`/e/${section.event.slug}`);
  return { success: true };
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
  answers?: Record<string, string>;
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

  let userId: string | undefined;
  if (data.guestEmail) {
    const normalizedEmail = data.guestEmail.toLowerCase().trim();
    const guestUser = await db.user.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, name: data.guestName },
      update: {},
      select: { id: true },
    });
    userId = guestUser.id;
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
      userId,
    },
  });

  if (data.answers && Object.keys(data.answers).length > 0) {
    await db.rSVPAnswer.createMany({
      data: Object.entries(data.answers)
        .filter(([, v]) => v.trim())
        .map(([rsvpFieldId, value]) => ({ rsvpId: rsvp.id, rsvpFieldId, value })),
    });
  }

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
    maybeEnabled?: boolean;
    questionnaireEnabled?: boolean;
    showTimestamps?: boolean;
    password?: string | null;
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

  db.invitation.createMany({
    data: emails.map((sentTo) => ({ eventId, sentTo, channel: "EMAIL" as const })),
  }).catch(() => {});

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

  db.invitation.createMany({
    data: phones.map((sentTo) => ({ eventId, sentTo, channel: "SMS" as const })),
  }).catch(() => {});

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

// ── Co-hosts ──────────────────────────────────────────────────────────────────

export async function addCoHost(eventId: string, email: string) {
  const event = await assertHost(eventId);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { success: false, error: "No account found for that email" };
  if (user.id === (await getSession())!.userId) return { success: false, error: "You are already the host" };
  try {
    await db.eventCoHost.create({ data: { eventId, userId: user.id } });
  } catch {
    return { success: false, error: "Already a co-host" };
  }
  revalidatePath(`/e/${event.slug}/settings`);
  return { success: true, cohostId: user.id, name: user.name, email: user.email };
}

export async function removeCoHost(cohostId: string) {
  const cohost = await db.eventCoHost.findUnique({
    where: { id: cohostId },
    select: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!cohost || cohost.event.hostId !== session?.userId) throw new Error("Forbidden");
  await db.eventCoHost.delete({ where: { id: cohostId } });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
}

// ── RSVP Fields ───────────────────────────────────────────────────────────────

export async function addRsvpField(
  eventId: string,
  data: { label: string; fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX"; required: boolean; options?: string; order: number }
) {
  const event = await assertHostOrCohost(eventId);
  const field = await db.rSVPField.create({
    data: { eventId, label: data.label, fieldType: data.fieldType, required: data.required, options: data.options ?? null, order: data.order },
  });
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: field.id };
}

export async function updateRsvpField(
  fieldId: string,
  data: { label: string; required: boolean; options?: string }
) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: { event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } } },
  });
  const session = await getSession();
  if (!field) throw new Error("Forbidden");
  const isOwner = field.event.hostId === session?.userId;
  const isCohost = field.event.coHosts.some((ch: { userId: string }) => ch.userId === session?.userId);
  if (!isOwner && !isCohost) throw new Error("Forbidden");
  await db.rSVPField.update({
    where: { id: fieldId },
    data: { label: data.label, required: data.required, options: data.options ?? null },
  });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
  return { success: true };
}

export async function deleteRsvpField(fieldId: string) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: { event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } } },
  });
  const session = await getSession();
  if (!field) throw new Error("Forbidden");
  const isOwner = field.event.hostId === session?.userId;
  const isCohost = field.event.coHosts.some((ch: { userId: string }) => ch.userId === session?.userId);
  if (!isOwner && !isCohost) throw new Error("Forbidden");
  await db.rSVPField.delete({ where: { id: fieldId } });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
}

export async function reorderRsvpFields(eventId: string, orderedIds: string[]) {
  const event = await assertHostOrCohost(eventId);
  await Promise.all(
    orderedIds.map((id, index) => db.rSVPField.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export type DashboardEvent = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  status: string;
  theme: { accentColor: string } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
};

export async function getDashboardEvents(): Promise<DashboardEvent[]> {
  const session = await getSession();
  if (!session) return [];

  const events = await db.event.findMany({
    where: {
      OR: [
        { hostId: session.userId },
        { coHosts: { some: { userId: session.userId } } },
      ],
    },
    include: {
      theme: { select: { accentColor: true } },
      rsvps: { select: { status: true, approved: true } },
      coHosts: { select: { userId: true } },
    },
    orderBy: { startAt: "desc" },
  });

  return events.map((e) => {
    const going = e.rsvps.filter((r: { status: string; approved: boolean }) => r.approved && r.status === "GOING").length;
    const maybe = e.rsvps.filter((r: { status: string; approved: boolean }) => r.approved && r.status === "MAYBE").length;
    const pending = e.rsvps.filter((r: { status: string; approved: boolean }) => !r.approved).length;
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      startAt: e.startAt,
      status: e.status,
      theme: e.theme,
      going,
      maybe,
      pending,
      isCohost: e.hostId !== session.userId,
    };
  });
}

export async function getRsvpFieldAnswers(fieldId: string) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: {
      event: { select: { hostId: true, coHosts: { select: { userId: true } } } },
      answers: { include: { rsvp: { select: { guestName: true } } }, orderBy: { id: "asc" } },
    },
  });
  const session = await getSession();
  if (!field) throw new Error("Forbidden");
  const isOwner = field.event.hostId === session?.userId;
  const isCohost = field.event.coHosts.some((ch: { userId: string }) => ch.userId === session?.userId);
  if (!isOwner && !isCohost) throw new Error("Forbidden");
  return field.answers.map((a: { value: string; rsvp: { guestName: string } }) => ({ guestName: a.rsvp.guestName, value: a.value }));
}

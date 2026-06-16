"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
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
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
}) {
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: { id: true, slug: true, approvalRequired: true, rsvpDeadline: true, capacity: true, startAt: true, locationName: true, host: { select: { name: true } } },
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
      status: data.status,
      plusOneCount: data.plusOneCount,
      approved: !event.approvalRequired,
    },
  });

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

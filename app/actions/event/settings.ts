"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { BaseTheme } from "@/lib/theme";
import { isValidFontId } from "@/lib/fonts";
import { isValidEffectId, isValidEffectDensity, isValidEffectSpeed } from "@/lib/effects";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { tzLocalToUtc } from "@/lib/utils";
import { SaveEventSettingsSchema } from "@/lib/schemas";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { assertHost, assertHostOrCohost } from "./shared";

// ── Inline field edits ─────────────────────────────────────────────────────────

const ALLOWED_FIELDS = new Set([
  "title",
  "description",
  "locationName",
  "locationAddress",
  "virtualUrl",
]);

export async function saveEventField(eventId: string, field: string, value: string) {
  if (!ALLOWED_FIELDS.has(field)) throw new Error("Field not allowed");
  const event = await assertHostOrCohost(eventId);
  await db.event.update({ where: { id: eventId }, data: { [field]: value || null } });
  const fieldTypes: Record<string, string> = {
    title: "event_title",
    description: "event_description",
    locationName: "event_location",
    locationAddress: "event_location",
    virtualUrl: "event_location",
  };
  const actType = fieldTypes[field] ?? "event_field";
  const detail = (() => {
    const v = (value || "").trim();
    if (field === "title") return v ? `Title updated to "${v}"` : "Title cleared";
    if (field === "locationName") return v ? `Location updated to "${v}"` : "Location name cleared";
    if (field === "locationAddress") return v ? `Address updated to "${v}"` : "Address cleared";
    if (field === "description") return "Description updated";
    if (field === "virtualUrl") return v ? "Virtual link updated" : "Virtual link cleared";
    return "Event updated";
  })();
  logActivity(eventId, actType, detail).catch(logSafe("saveEventField"));
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
  const event = await assertHostOrCohost(eventId);
  await db.event.update({
    where: { id: eventId },
    data: {
      locationType: data.locationType,
      locationName: data.locationName || null,
      locationAddress: data.locationAddress || null,
      virtualUrl: data.virtualUrl || null,
    },
  });
  const locDetail = (() => {
    if (data.locationType === "VIRTUAL") return "Location set to virtual";
    if (data.locationType === "TBD") return "Location set to TBD";
    return data.locationName ? `Location updated to "${data.locationName}"` : "Location updated";
  })();
  logActivity(eventId, "event_location", locDetail).catch(logSafe("saveEventLocation"));
  revalidatePath(`/e/${event.slug}`);
}

// ── Theme ──────────────────────────────────────────────────────────────────────

export interface ThemeExtras {
  fontId?: string | null;
  effectId?: string | null;
  effectDensity?: string | null;
  effectSpeed?: string | null;
}

export async function saveEventTheme(
  eventId: string,
  baseTheme: BaseTheme,
  gradientFrom: string,
  gradientTo: string,
  accentColor: string,
  presetId?: string | null,
  cardOpacity?: number | null,
  extras?: ThemeExtras
) {
  const event = await assertHostOrCohost(eventId);
  if (extras) {
    if (!isValidFontId(extras.fontId)) throw new Error("Unknown font");
    if (!isValidEffectId(extras.effectId)) throw new Error("Unknown effect");
    if (!isValidEffectDensity(extras.effectDensity)) throw new Error("Invalid effect density");
    if (!isValidEffectSpeed(extras.effectSpeed)) throw new Error("Invalid effect speed");
  }
  await db.eventTheme.upsert({
    where: { eventId },
    update: {
      baseTheme,
      gradientFrom,
      gradientTo,
      accentColor,
      ...(presetId !== undefined ? { appliedPresetId: presetId } : {}),
      ...(cardOpacity !== undefined ? { cardOpacity } : {}),
      ...(extras && extras.fontId !== undefined ? { fontId: extras.fontId } : {}),
      ...(extras && extras.effectId !== undefined ? { effectId: extras.effectId } : {}),
      ...(extras && extras.effectDensity !== undefined
        ? { effectDensity: extras.effectDensity }
        : {}),
      ...(extras && extras.effectSpeed !== undefined ? { effectSpeed: extras.effectSpeed } : {}),
    },
    create: {
      eventId,
      baseTheme,
      gradientFrom,
      gradientTo,
      accentColor,
      appliedPresetId: presetId ?? null,
      cardOpacity: cardOpacity ?? null,
      fontId: extras?.fontId ?? null,
      effectId: extras?.effectId ?? null,
      effectDensity: extras?.effectDensity ?? null,
      effectSpeed: extras?.effectSpeed ?? null,
    },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── Event settings ─────────────────────────────────────────────────────────────

export async function saveEventSettings(
  eventId: string,
  settings: {
    commentsEnabled?: boolean;
    plusOneAllowed?: boolean;
    plusOneMax?: number;
    plusOneNamesRequired?: boolean;
    approvalRequired?: boolean;
    rsvpDeadline?: string | null;
    allowEditAfterDeadline?: boolean;
    capacity?: number | null;
    guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
    visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
    maybeEnabled?: boolean;
    questionnaireEnabled?: boolean;
    showTimestamps?: boolean;
    password?: string | null;
    guestSharingEnabled?: boolean;
    guestsCanInvite?: boolean;
    hostDisplayName?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const event = await assertHostOrCohost(eventId);

  const session = await getSession();
  const isOwner = event.hostId === session?.userId || session?.role === "ADMIN";
  if (!isOwner && settings.hostDisplayName !== undefined) {
    const currentEvent = await db.event.findUnique({
      where: { id: eventId },
      select: { hostDisplayName: true },
    });
    if (settings.hostDisplayName !== currentEvent?.hostDisplayName) {
      throw new Error("Forbidden: Only the host can change host display name");
    }
  }

  // SEC-20: validate against an explicit allow-list before spreading into the
  // update, so unknown keys (status, slug, hostId, …) can't be mass-assigned.
  const { password, rsvpDeadline, ...rest } = SaveEventSettingsSchema.parse(settings);
  const passwordHash =
    password === undefined
      ? undefined
      : password === null || password === ""
        ? null
        : await bcrypt.hash(password, 10);
  await db.event.update({
    where: { id: eventId },
    data: {
      ...rest,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      rsvpDeadline: rsvpDeadline
        ? new Date(rsvpDeadline)
        : rsvpDeadline === null
          ? null
          : undefined,
    },
  });
  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/settings`);
  return { success: true };
}

// ── Date/time edit ─────────────────────────────────────────────────────────────

export async function saveEventDates(
  eventId: string,
  startAt: string, // "YYYY-MM-DDTHH:MM" in the event's timezone
  endAt: string | null
) {
  const event = await assertHostOrCohost(eventId);
  const evt = await db.event.findUnique({ where: { id: eventId }, select: { timezone: true } });
  if (!evt) throw new Error("Event not found");
  await db.event.update({
    where: { id: eventId },
    data: {
      startAt: tzLocalToUtc(startAt, evt.timezone),
      endAt: endAt ? tzLocalToUtc(endAt, evt.timezone) : null,
    },
  });
  const [d, t] = startAt.split("T");
  const [, mo, day] = d.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [h, min] = t.split(":").map(Number);
  const timeStr = `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  logActivity(
    eventId,
    "event_date",
    `Date updated to ${months[parseInt(mo) - 1]} ${parseInt(day)} at ${timeStr}`
  ).catch(logSafe("saveEventDates"));
  revalidatePath(`/e/${event.slug}`);
}

// ── Cover image ────────────────────────────────────────────────────────────────

export async function saveCoverImage(eventId: string, url: string) {
  const event = await assertHostOrCohost(eventId);
  await db.eventTheme.upsert({
    where: { eventId },
    update: { coverImageUrl: url },
    create: { eventId, coverImageUrl: url },
  });
  revalidatePath(`/e/${event.slug}`);
}

export async function removeCoverImage(eventId: string) {
  const event = await assertHostOrCohost(eventId);
  await db.eventTheme.update({
    where: { eventId },
    data: { coverImageUrl: null },
  });
  revalidatePath(`/e/${event.slug}`);
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
  }
) {
  const event = await assertHostOrCohost(eventId);
  await db.eventReminderSettings.upsert({
    where: { eventId },
    update: settings,
    create: { eventId, ...settings },
  });
  revalidatePath(`/e/${event.slug}/settings`);
}

// ── Public theme preset fetch (for the SettingsPage theme builder) ────────────

export async function getActiveThemePresets() {
  return db.themePreset.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// Tombstones the event as DELETED and hard-deletes all guest data for GDPR compliance.
// Only the host, co-hosts (or admin) may delete their event this way.
export async function deleteEvent(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, status: true },
  });
  if (!event) throw new Error("Event not found");
  await assertHost(eventId);
  if (event.status === "DELETED") throw new Error("Event is already deleted");

  // Hard-delete all guest data before tombstoning (GDPR: purpose no longer exists)
  await db.$transaction([
    db.rSVPAnswer.deleteMany({ where: { rsvp: { eventId } } }),
    db.plusOneGuest.deleteMany({ where: { rsvp: { eventId } } }),
    db.rSVP.deleteMany({ where: { eventId } }),
    db.checkIn.deleteMany({ where: { eventId } }),
    db.comment.deleteMany({ where: { eventId } }),
    db.pollVote.deleteMany({ where: { poll: { eventId } } }),
    db.pollOption.deleteMany({ where: { poll: { eventId } } }),
    db.poll.deleteMany({ where: { eventId } }),
    db.potluckClaim.deleteMany({ where: { potluckItem: { eventId } } }),
    db.potluckItem.deleteMany({ where: { eventId } }),
    db.invitation.deleteMany({ where: { eventId } }),
    db.eventUpdate.deleteMany({ where: { eventId } }),
    db.eventInfoSection.deleteMany({ where: { eventId } }),
    db.sentReminder.deleteMany({ where: { eventId } }),
    db.activityEvent.deleteMany({ where: { eventId } }),
    db.eventCoHost.deleteMany({ where: { eventId } }),
    db.event.update({ where: { id: eventId }, data: { status: "DELETED" } }),
  ]);

  revalidatePath(`/e/${event.slug}`);
  revalidatePath("/dashboard");
  return { success: true };
}

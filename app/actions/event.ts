"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  sendRsvpConfirmationEmail,
  sendBlastEmail,
  sendEventInviteEmail,
  sendApprovalEmail,
} from "@/lib/email";
import {
  sendRsvpConfirmationSms,
  sendSmsBlast as smsSendBlast,
  sendApprovalSms,
  sendEventInviteSms,
} from "@/lib/sms";
import type { BaseTheme } from "@/lib/theme";
import { logActivity, iconLabel } from "@/lib/activity";
import { tzLocalToUtc } from "@/lib/utils";
import {
  AddRsvpSchema,
  UpdateRsvpSchema,
  AddCommentSchema,
  SaveEventSettingsSchema,
} from "@/lib/schemas";
import { cookies } from "next/headers";
import { getUnlockSignature } from "@/lib/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { withEventCapacityLock } from "@/lib/capacityLock";
import bcrypt from "bcryptjs";

export async function verifyEventPassword(
  slug: string,
  rawPassword: string
): Promise<{ success: boolean; error?: string }> {
  // SEC-19: throttle online brute-force of password-gated events. bcrypt slows
  // each guess but without an attempt cap an attacker can still grind a weak
  // password. Limit to 10 attempts per slug+IP per 10 minutes.
  const ip = await getClientIp();
  const limit = await rateLimit(`event-pw:${slug}:${ip}`, 10, 600);
  if (!limit.success) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const event = await db.event.findUnique({
    where: { slug },
    select: { passwordHash: true },
  });

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  const password = rawPassword.trim();
  if (!event.passwordHash || !(await bcrypt.compare(password, event.passwordHash))) {
    return { success: false, error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  const signature = getUnlockSignature(slug);

  cookieStore.set(`rsvp-unlocked-${slug}`, signature, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return { success: true };
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function assertHost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, slug: true },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("Forbidden");
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
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  return event;
}

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
  const event = await assertHost(eventId);
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
  logActivity(eventId, actType, detail).catch(() => {});
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
  const locDetail = (() => {
    if (data.locationType === "VIRTUAL") return "Location set to virtual";
    if (data.locationType === "TBD") return "Location set to TBD";
    return data.locationName ? `Location updated to "${data.locationName}"` : "Location updated";
  })();
  logActivity(eventId, "event_location", locDetail).catch(() => {});
  revalidatePath(`/e/${event.slug}`);
}

// ── Theme ──────────────────────────────────────────────────────────────────────

export async function saveEventTheme(
  eventId: string,
  baseTheme: BaseTheme,
  gradientFrom: string,
  gradientTo: string,
  accentColor: string,
  presetId?: string | null,
  cardOpacity?: number | null
) {
  const event = await assertHost(eventId);
  await db.eventTheme.upsert({
    where: { eventId },
    update: {
      baseTheme,
      gradientFrom,
      gradientTo,
      accentColor,
      ...(presetId !== undefined ? { appliedPresetId: presetId } : {}),
      ...(cardOpacity !== undefined ? { cardOpacity } : {}),
    },
    create: {
      eventId,
      baseTheme,
      gradientFrom,
      gradientTo,
      accentColor,
      appliedPresetId: presetId ?? null,
      cardOpacity: cardOpacity ?? null,
    },
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
  const preview = data.content.slice(0, 60) + (data.content.length > 60 ? "…" : "");
  const activityEvent = await logActivity(
    data.eventId,
    "info_add",
    `Added ${iconLabel(data.type)} section: ${preview}`
  ).catch(() => null);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: section.id, activityEvent };
}

export async function updateInfoSection(
  sectionId: string,
  data: { type?: string; title?: string | null; content: string; url: string | null }
) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { hostId: true, slug: true, id: true } } },
  });
  const session = await getSession();
  if (!section || (section.event.hostId !== session?.userId && session?.role !== "ADMIN"))
    throw new Error("Forbidden");
  await db.eventInfoSection.update({
    where: { id: sectionId },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      title: null,
      content: data.content,
      url: data.url || null,
    },
  });
  const editPreview = data.content.slice(0, 60) + (data.content.length > 60 ? "…" : "");
  logActivity(
    section.eventId,
    "info_edit",
    `Updated ${iconLabel(data.type ?? section.type)} section: ${editPreview}`
  ).catch(() => {});
  revalidatePath(`/e/${section.event.slug}`);
  return { success: true };
}

export async function removeInfoSection(sectionId: string) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!section || (section.event.hostId !== session?.userId && session?.role !== "ADMIN"))
    throw new Error("Forbidden");
  await db.eventInfoSection.delete({ where: { id: sectionId } });
  const activityEvent = await logActivity(
    section.eventId,
    "info_delete",
    `Removed ${iconLabel(section.type)} section`
  ).catch(() => null);
  revalidatePath(`/e/${section.event.slug}`);
  return { activityEvent };
}

// ── RSVP ──────────────────────────────────────────────────────────────────────

export async function addRSVP(rawInput: unknown) {
  const data = AddRsvpSchema.parse(rawInput);
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      approvalRequired: true,
      rsvpDeadline: true,
      capacity: true,
      startAt: true,
      locationName: true,
      host: { select: { name: true, email: true } },
    },
  });
  if (!event) return { success: false, error: "Event not found" };
  if (event.rsvpDeadline && event.rsvpDeadline < new Date())
    return { success: false, error: "RSVP deadline has passed" };

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
  } else if (data.guestPhone) {
    const phone = data.guestPhone.trim().replace(/[\s\-().]/g, "");
    const guestUser = await db.user.upsert({
      where: { phone },
      create: { phone, name: data.guestName },
      update: {},
      select: { id: true },
    });
    userId = guestUser.id;
  }

  // If a host pre-invited this guest, update their existing INVITED RSVP instead of creating a duplicate
  const existingInvited = userId
    ? await db.rSVP.findFirst({
        where: { eventId: data.eventId, userId, status: "INVITED" },
      })
    : null;

  // SEC-12: the capacity check and the RSVP write run under a per-event lock so
  // two concurrent GOING submissions can't both pass a stale `count()` before
  // either row is committed (which would overbook the event). The re-count must
  // happen *inside* the lock, immediately before the write.
  const locked = await withEventCapacityLock(data.eventId, async () => {
    if (event.capacity && data.status === "GOING") {
      const goingCount = await db.rSVP.count({
        where: { eventId: data.eventId, status: "GOING", approved: true },
      });
      if (goingCount >= event.capacity) return { atCapacity: true as const };
    }

    let rsvp;
    if (existingInvited) {
      rsvp = await db.rSVP.update({
        where: { id: existingInvited.id },
        data: {
          guestName: data.guestName,
          status: data.status,
          plusOneCount: data.plusOneCount,
          note: data.note || null,
          approved: !event.approvalRequired,
          responded: true,
        },
      });
    } else {
      rsvp = await db.rSVP.create({
        data: {
          eventId: data.eventId,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          status: data.status,
          plusOneCount: data.plusOneCount,
          note: data.note || null,
          approved: !event.approvalRequired,
          responded: true,
          userId,
        },
      });
    }
    return { atCapacity: false as const, rsvp };
  });

  if (locked.atCapacity) return { success: false, error: "Event is at capacity" };
  const rsvp = locked.rsvp;

  if (data.answers && Object.keys(data.answers).length > 0) {
    await db.rSVPAnswer.createMany({
      data: Object.entries(data.answers)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([rsvpFieldId, value]) => ({ rsvpId: rsvp.id, rsvpFieldId, value: value as string })),
    });
  }

  if (data.plusOneGuestNames && data.plusOneGuestNames.length > 0) {
    await db.plusOneGuest.createMany({
      data: data.plusOneGuestNames
        .filter((n) => n.trim())
        .map((name, order) => ({ rsvpId: rsvp.id, name: name.trim(), order })),
    });
  }

  const statusText =
    data.status === "GOING" ? "going" : data.status === "MAYBE" ? "maybe" : "not going";
  const plusStr = data.plusOneCount > 0 ? ` +${data.plusOneCount}` : "";
  const detail = data.note?.trim()
    ? `${data.guestName} is ${statusText}${plusStr}\n${data.note.trim()}`
    : `${data.guestName} is ${statusText}${plusStr}`;
  logActivity(data.eventId, "rsvp_new", detail, data.guestName).catch(() => {});

  if (data.guestEmail) {
    sendRsvpConfirmationEmail(data.guestEmail, {
      guestName: data.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      status: data.status,
      editToken: rsvp.editToken,
      startAt: event.startAt,
      locationName: event.locationName,
      replyTo: event.host.email || undefined,
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
export async function addComment(rawInput: unknown) {
  const data = AddCommentSchema.parse(rawInput);

  // Load the event once — reused for the comments-enabled gate and the SEC-17
  // host/co-host relationship check below.
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: {
      slug: true,
      commentsEnabled: true,
      hostId: true,
      visibility: true,
      coHosts: { select: { userId: true } },
    },
  });
  if (!event?.commentsEnabled) return { success: false, error: "Comments disabled" };

  // SEC-17: authorize the author and derive the stored display name server-side.
  // Mirrors the castVote / claimPotluckItem authorization shape — host/co-host/
  // admin may comment freely; everyone else must present an approved RSVP for
  // this event. The name is never taken from the client: it comes from the user
  // record or the matched RSVP row, so a caller can't post under another
  // person's identity. It also closes the PRIVATE-event bypass: a logged-in
  // user with no host/guest relationship is rejected for PRIVATE events here
  // (rather than relying on the page.tsx visibility gate), while PUBLIC/UNLISTED
  // events — viewable by anyone — accept any logged-in user's verified name.
  const session = await getSession();
  const isHost = event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);

  let guestName: string;
  let rsvpId: string | null = null;

  if (session && (isHost || isCohost)) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    guestName = user?.name?.trim() || user?.email || "Host";
  } else if (session) {
    // Authenticated non-host. Look up any RSVP linked to their account.
    const rsvp = await db.rSVP.findFirst({
      where: { eventId: data.eventId, userId: session.userId },
      select: { id: true, guestName: true, approved: true },
    });
    if (rsvp) {
      // A guest with an RSVP comments under their RSVP name, but only once the
      // host has approved it — a pending RSVP can view but not comment.
      if (!rsvp.approved) {
        return { success: false, error: "You must be an approved guest to comment." };
      }
      guestName = rsvp.guestName;
      rsvpId = rsvp.id;
    } else if (event.visibility === "PRIVATE") {
      // No RSVP and no host/co-host relationship to a PRIVATE event — this is
      // the SEC-17 case: a logged-in user must not comment on an event they
      // have no access to.
      return { success: false, error: "You must be an approved guest to comment." };
    } else {
      // PUBLIC / UNLISTED events are viewable by anyone, so a logged-in user
      // with no RSVP may comment under their own verified identity (name taken
      // from the user record, never the client).
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      });
      guestName = user?.name?.trim() || user?.email || "Guest";
    }
  } else {
    // Unauthenticated guest (SEC-3): require an approved RSVP for this event
    // whose name matches the token-backed identity the client supplied.
    if (!data.rsvpId) {
      return { success: false, error: "An RSVP is required to comment." };
    }
    const rsvp = await db.rSVP.findFirst({
      where: { id: data.rsvpId, eventId: data.eventId, approved: true },
      select: { id: true, guestName: true },
    });
    if (!rsvp) {
      return { success: false, error: "A valid approved RSVP is required to comment." };
    }
    if (rsvp.guestName !== data.guestName) {
      return { success: false, error: "Guest name does not match RSVP." };
    }
    guestName = rsvp.guestName;
    rsvpId = rsvp.id;
  }

  // SEC-13: when replying, verify the parent comment belongs to THIS event so a
  // reply can't be threaded under a comment from a different event.
  let parentId: string | null = null;
  if (data.parentId) {
    const parent = await db.comment.findFirst({
      where: { id: data.parentId, eventId: data.eventId },
      select: { id: true },
    });
    if (!parent) {
      return { success: false, error: "Invalid parent comment." };
    }
    parentId = parent.id;
  }

  const comment = await db.comment.create({
    data: {
      eventId: data.eventId,
      guestName,
      body: data.body,
      rsvpId,
      parentId,
    },
  });

  // Log comment activity
  const bodyPreview = data.body.slice(0, 30) + (data.body.length > 30 ? "..." : "");
  await logActivity(
    data.eventId,
    "comment_new",
    `${guestName} commented: "${bodyPreview}"`,
    guestName
  ).catch(() => {});

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
    plusOneNamesRequired?: boolean;
    approvalRequired?: boolean;
    rsvpDeadline?: string | null;
    capacity?: number | null;
    guestListVis?: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
    visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
    maybeEnabled?: boolean;
    questionnaireEnabled?: boolean;
    showTimestamps?: boolean;
    password?: string | null;
    guestSharingEnabled?: boolean;
    guestsCanInvite?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const event = await assertHost(eventId);
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

// ── RSVP edit (guest) ─────────────────────────────────────────────────────────

export async function updateRSVP(editToken: string, rawInput: unknown) {
  const data = UpdateRsvpSchema.parse(rawInput);
  const rsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: { event: { select: { slug: true, capacity: true, rsvpDeadline: true } } },
  });
  if (!rsvp) return { success: false, error: "RSVP not found" };

  // SEC-21(b): a token-holding guest could previously flip to GOING after the
  // deadline or past capacity — a capacity-bypass cousin of SEC-12. Re-validate
  // both here. Declining (NO) is always allowed so guests can cancel late.
  if (rsvp.event.rsvpDeadline && rsvp.event.rsvpDeadline < new Date() && data.status !== "NO") {
    return { success: false, error: "RSVP deadline has passed" };
  }

  // Only a transition *into* GOING consumes a new seat; note edits or downgrades
  // on an already-GOING RSVP must not be blocked by the capacity gate.
  const transitioningToGoing = data.status === "GOING" && rsvp.status !== "GOING";

  const locked = await withEventCapacityLock(rsvp.eventId, async () => {
    if (rsvp.event.capacity && transitioningToGoing) {
      const goingCount = await db.rSVP.count({
        where: { eventId: rsvp.eventId, status: "GOING", approved: true },
      });
      if (goingCount >= rsvp.event.capacity) return { atCapacity: true as const };
    }

    await db.rSVP.update({
      where: { editToken },
      data: {
        status: data.status,
        plusOneCount: data.plusOneCount,
        responded: true,
        ...(data.note !== undefined && { note: data.note || null }),
      },
    });
    return { atCapacity: false as const };
  });

  if (locked.atCapacity) return { success: false, error: "Event is at capacity" };

  if (data.plusOneGuestNames !== undefined) {
    await db.plusOneGuest.deleteMany({ where: { rsvpId: rsvp.id } });
    if (data.plusOneGuestNames.length > 0) {
      await db.plusOneGuest.createMany({
        data: data.plusOneGuestNames
          .filter((n) => n.trim())
          .map((name, order) => ({ rsvpId: rsvp.id, name: name.trim(), order })),
      });
    }
  }

  if (data.answers && Object.keys(data.answers).length > 0) {
    await Promise.all(
      Object.entries(data.answers)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([rsvpFieldId, value]) =>
          db.rSVPAnswer.upsert({
            where: { rsvpId_rsvpFieldId: { rsvpId: rsvp.id, rsvpFieldId } },
            create: { rsvpId: rsvp.id, rsvpFieldId, value: value as string },
            update: { value: value as string },
          })
        )
    );
  }

  const statusText =
    data.status === "GOING" ? "going" : data.status === "MAYBE" ? "maybe" : "not going";
  logActivity(
    rsvp.eventId,
    "rsvp_update",
    `${rsvp.guestName} updated to ${statusText}`,
    rsvp.guestName
  ).catch(() => {});

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true, rsvpId: rsvp.id };
}

export async function deleteRsvpAsHost(rsvpId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        select: { id: true, hostId: true, slug: true, coHosts: { select: { userId: true } } },
      },
    },
  });
  if (!rsvp) throw new Error("Not found");
  const isOwner = rsvp.event.hostId === session.userId;
  const isCohost = rsvp.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session.userId
  );
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  await db.rSVP.delete({ where: { id: rsvpId } });
  logActivity(rsvp.event.id, "rsvp_delete", `${rsvp.guestName}'s RSVP was removed`).catch(() => {});
  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function deleteActivityEvent(activityId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const activity = await db.activityEvent.findUnique({
    where: { id: activityId },
    include: { event: { select: { hostId: true, coHosts: { select: { userId: true } } } } },
  });
  if (!activity) return { success: false };
  const isOwner = activity.event.hostId === session.userId;
  const isCohost = activity.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session.userId
  );
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  await db.activityEvent.delete({ where: { id: activityId } });
  return { success: true };
}

// ── Message blast ──────────────────────────────────────────────────────────────

export async function sendBlast(
  eventId: string,
  message: string,
  filters: ("ALL" | "INVITED" | "GOING" | "MAYBE" | "NO")[]
) {
  await assertHost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, host: { select: { name: true, email: true } } },
  });
  if (!event) throw new Error("Event not found");

  const orConditions: { status?: "GOING" | "MAYBE" | "NO" | "INVITED"; responded?: boolean }[] = [];
  for (const filter of filters) {
    if (filter === "ALL") {
      orConditions.length = 0;
      break;
    } else if (filter === "GOING") {
      orConditions.push({ status: "GOING", responded: true });
    } else if (filter === "MAYBE") {
      orConditions.push({ status: "MAYBE", responded: true });
    } else if (filter === "NO") {
      orConditions.push({ status: "NO", responded: true });
    } else if (filter === "INVITED") {
      orConditions.push({ status: "INVITED" });
    }
  }

  const whereStatus = orConditions.length > 0 ? { OR: orConditions } : {};

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
    replyTo: event.host.email || undefined,
  });

  db.invitation
    .createMany({
      data: emails.map((sentTo) => ({ eventId, sentTo, channel: "EMAIL" as const })),
    })
    .catch(() => {});

  return { success: true, sent: emails.length };
}

export async function sendSmsBlast(
  eventId: string,
  message: string,
  filters: ("ALL" | "INVITED" | "GOING" | "MAYBE" | "NO")[]
) {
  await assertHost(eventId);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error("Event not found");

  const orConditions: { status?: "GOING" | "MAYBE" | "NO" | "INVITED"; responded?: boolean }[] = [];
  for (const filter of filters) {
    if (filter === "ALL") {
      orConditions.length = 0;
      break;
    } else if (filter === "GOING") {
      orConditions.push({ status: "GOING", responded: true });
    } else if (filter === "MAYBE") {
      orConditions.push({ status: "MAYBE", responded: true });
    } else if (filter === "NO") {
      orConditions.push({ status: "NO", responded: true });
    } else if (filter === "INVITED") {
      orConditions.push({ status: "INVITED" });
    }
  }

  const whereStatus = orConditions.length > 0 ? { OR: orConditions } : {};

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
    .catch(() => {});

  return { success: true, sent };
}

// ── Date/time edit ─────────────────────────────────────────────────────────────

export async function saveEventDates(
  eventId: string,
  startAt: string, // "YYYY-MM-DDTHH:MM" in the event's timezone
  endAt: string | null
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
  ).catch(() => {});
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

export async function removeCoverImage(eventId: string) {
  const event = await assertHost(eventId);
  await db.eventTheme.update({
    where: { eventId },
    data: { coverImageUrl: null },
  });
  revalidatePath(`/e/${event.slug}`);
}

// ── RSVP approval ─────────────────────────────────────────────────────────────

export async function approveRsvp(rsvpId: string, message?: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          title: true,
          host: { select: { email: true } },
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error("Not found");
  const isOwner = rsvp.event.hostId === session.userId;
  const isCohost = rsvp.event.coHosts?.some((ch) => ch.userId === session.userId) ?? false;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");

  await db.rSVP.update({ where: { id: rsvpId }, data: { approved: true } });

  if (rsvp.guestEmail) {
    await sendApprovalEmail(rsvp.guestEmail, {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: true,
      message,
      replyTo: rsvp.event.host.email || undefined,
    }).catch(() => {});
  } else if (rsvp.guestPhone) {
    await sendApprovalSms(rsvp.guestPhone, {
      eventTitle: rsvp.event.title,
      approved: true,
      message,
    }).catch(() => {});
  }

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function declineRsvp(rsvpId: string, message?: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          title: true,
          host: { select: { email: true } },
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error("Not found");
  const isOwner = rsvp.event.hostId === session.userId;
  const isCohost = rsvp.event.coHosts?.some((ch) => ch.userId === session.userId) ?? false;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");

  if (rsvp.guestEmail) {
    await sendApprovalEmail(rsvp.guestEmail, {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: false,
      message,
      replyTo: rsvp.event.host.email || undefined,
    }).catch(() => {});
  } else if (rsvp.guestPhone) {
    await sendApprovalSms(rsvp.guestPhone, {
      eventTitle: rsvp.event.title,
      approved: false,
      message,
    }).catch(() => {});
  }

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
        select: { title: true, host: { select: { name: true, email: true } } },
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
          replyTo,
        }).catch(() => {});
      }
      if (smsGuests.length > 0) {
        smsSendBlast(smsGuests, {
          eventTitle,
          eventSlug: event.slug,
          message: body,
          hostName,
        }).catch(() => {});
      }
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
  if (!update || (update.event.hostId !== session?.userId && session?.role !== "ADMIN"))
    throw new Error("Forbidden");
  await db.eventUpdate.delete({ where: { id: updateId } });
  revalidatePath(`/e/${update.event.slug}`);
}

// ── Potluck ───────────────────────────────────────────────────────────────────

export async function addPotluckItem(eventId: string, label: string, quantity: number = 1) {
  const event = await assertHost(eventId);
  const item = await db.potluckItem.create({ data: { eventId, label, quantity } });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: item.id };
}

export async function removePotluckItem(itemId: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { event: { select: { hostId: true, slug: true } } },
  });
  const session = await getSession();
  if (!item || (item.event.hostId !== session?.userId && session?.role !== "ADMIN"))
    throw new Error("Forbidden");
  await db.potluckItem.delete({ where: { id: itemId } });
  revalidatePath(`/e/${item.event.slug}`);
}

export async function claimPotluckItem(
  itemId: string,
  guestName: string,
  claimedQty: number = 1,
  guestRsvpId?: string
) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    include: {
      claims: true,
      event: { select: { slug: true, hostId: true, coHosts: { select: { userId: true } } } },
    },
  });
  if (!item) return { success: false, error: "Item not found" };

  // SEC-4: require host/cohost session OR a verified approved RSVP
  const session = await getSession();
  const isHost = item.event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = item.event.coHosts.some((ch) => ch.userId === session?.userId);
  if (!isHost && !isCohost) {
    if (!guestRsvpId) {
      return { success: false, error: "A valid RSVP is required to claim items." };
    }
    const rsvp = await db.rSVP.findFirst({
      where: { id: guestRsvpId, eventId: item.eventId, approved: true },
      select: { guestName: true },
    });
    if (!rsvp) {
      return { success: false, error: "A valid approved RSVP is required to claim items." };
    }
    if (rsvp.guestName !== guestName) {
      return { success: false, error: "Guest name does not match RSVP." };
    }
  }

  const totalClaimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
  const remaining = item.quantity - totalClaimed;
  if (claimedQty > remaining) {
    return { success: false, error: `Only ${remaining} remaining` };
  }

  const claim = await db.potluckClaim.create({
    data: {
      potluckItemId: itemId,
      guestName,
      quantity: claimedQty,
    },
  });

  const qtyStr = claimedQty > 1 ? ` (x${claimedQty})` : "";
  const activityEvent = await logActivity(
    item.eventId,
    "potluck_claim",
    `${guestName} is bringing${qtyStr}: ${item.label}`,
    guestName
  ).catch(() => null);
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent, claim };
}

export async function unclaimPotluckItem(itemId: string, guestName: string, guestRsvpId?: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    include: {
      claims: true,
      event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } },
    },
  });
  if (!item) return { success: false, error: "Item not found" };

  const session = await getSession();
  const isHost = item.event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = item.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session?.userId
  );

  // SEC-4: guests must supply a verified RSVP; hosts/cohosts/admins may unclaim freely
  if (!isHost && !isCohost) {
    if (!guestRsvpId) {
      return { success: false, error: "A valid RSVP is required to unclaim items." };
    }
    const rsvp = await db.rSVP.findFirst({
      where: { id: guestRsvpId, eventId: item.eventId, approved: true },
      select: { guestName: true },
    });
    if (!rsvp || rsvp.guestName !== guestName) {
      return { success: false, error: "Guest name does not match RSVP." };
    }
  }

  const claim = item.claims.find((c) => c.guestName === guestName);
  if (!claim) {
    return { success: false, error: "Claim not found" };
  }

  await db.potluckClaim.delete({
    where: { id: claim.id },
  });

  const activityEvent = await logActivity(
    item.eventId,
    "potluck_unclaim",
    `${guestName} won't bring: ${item.label}`,
    guestName
  ).catch(() => null);
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent };
}

// ── Co-hosts ──────────────────────────────────────────────────────────────────

export async function addCoHost(eventId: string, email: string) {
  const event = await assertHost(eventId);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { success: false, error: "No account found for that email" };
  if (user.id === (await getSession())!.userId)
    return { success: false, error: "You are already the host" };
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
  if (!cohost || (cohost.event.hostId !== session?.userId && session?.role !== "ADMIN"))
    throw new Error("Forbidden");
  await db.eventCoHost.delete({ where: { id: cohostId } });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
}

// ── RSVP Fields ───────────────────────────────────────────────────────────────

export async function addRsvpField(
  eventId: string,
  data: {
    label: string;
    fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
    required: boolean;
    options?: string;
    order: number;
  }
) {
  const event = await assertHostOrCohost(eventId);
  const field = await db.rSVPField.create({
    data: {
      eventId,
      label: data.label,
      fieldType: data.fieldType,
      required: data.required,
      options: data.options ?? null,
      order: data.order,
    },
  });
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: field.id };
}

export async function updateRsvpField(
  fieldId: string,
  data: { label?: string; required?: boolean; options?: string; fieldType?: string }
) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: {
      event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } },
    },
  });
  const session = await getSession();
  if (!field) throw new Error("Forbidden");
  const isOwner = field.event.hostId === session?.userId;
  const isCohost = field.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session?.userId
  );
  const isAdmin = session?.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  await db.rSVPField.update({
    where: { id: fieldId },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.options !== undefined && { options: data.options || null }),
      ...(data.fieldType !== undefined && {
        fieldType: data.fieldType as "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX",
      }),
    },
  });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
  return { success: true };
}

export async function deleteRsvpField(fieldId: string) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: {
      event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } },
    },
  });
  const session = await getSession();
  if (!field) throw new Error("Forbidden");
  const isOwner = field.event.hostId === session?.userId;
  const isCohost = field.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session?.userId
  );
  const isAdmin = session?.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  await db.rSVPField.delete({ where: { id: fieldId } });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
}

export async function reorderRsvpFields(eventId: string, orderedIds: string[]) {
  const event = await assertHostOrCohost(eventId);

  // SEC-2: verify every supplied ID belongs to this event before touching the DB
  if (orderedIds.length > 0) {
    const ownedFields = await db.rSVPField.findMany({
      where: { eventId },
      select: { id: true },
    });
    const ownedSet = new Set(ownedFields.map((f) => f.id));
    if (!orderedIds.every((id) => ownedSet.has(id))) {
      throw new Error("Forbidden: one or more field IDs do not belong to this event");
    }
  }

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
  theme: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
  host?: { name: string | null; email: string | null; avatarUrl: string | null } | null;
  coHosts?: { id: string; name: string | null; email: string | null; avatarUrl: string | null }[];
  commentCount: number;
};

export type DashboardInvite = {
  id: string;
  slug: string;
  title: string;
  startAt: Date;
  status: string;
  theme: {
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    coverImageUrl: string | null;
  } | null;
  going: number;
  maybe: number;
  pending: number;
  isCohost: boolean;
  host: { name: string | null; email: string | null; avatarUrl: string | null } | null;
  coHosts?: { id: string; name: string | null; email: string | null; avatarUrl: string | null }[];
  commentCount: number;
  userRsvpStatus: string;
  userRsvpEditToken: string;
};

export type DashboardActivity = {
  id: string;
  eventId: string;
  type: string;
  actorName: string | null;
  detail: string;
  createdAt: Date;
  event: {
    title: string;
    slug: string;
  };
};

type CoHostQueryItem = {
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  userId?: string;
};

export async function getDashboardEvents(): Promise<DashboardEvent[]> {
  const session = await getSession();
  if (!session) return [];

  const events = await db.event.findMany({
    where: {
      status: { not: "DELETED" },
      OR: [{ hostId: session.userId }, { coHosts: { some: { userId: session.userId } } }],
    },
    include: {
      theme: {
        select: { gradientFrom: true, gradientTo: true, accentColor: true, coverImageUrl: true },
      },
      rsvps: { select: { status: true, approved: true } },
      coHosts: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      host: { select: { name: true, email: true, avatarUrl: true } },
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { startAt: "desc" },
  });

  return events.map((e) => {
    const going = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => r.approved && r.status === "GOING"
    ).length;
    const maybe = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => r.approved && r.status === "MAYBE"
    ).length;
    const pending = e.rsvps.filter(
      (r: { status: string; approved: boolean }) => !r.approved
    ).length;
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
      host: e.host,
      coHosts: e.coHosts
        ? (e.coHosts
            .map(
              (ch: CoHostQueryItem) =>
                ch.user ||
                (ch.userId ? { id: ch.userId, name: null, email: null, avatarUrl: null } : null)
            )
            .filter(Boolean) as {
            id: string;
            name: string | null;
            email: string | null;
            avatarUrl: string | null;
          }[])
        : [],
      commentCount: e._count?.comments ?? 0,
    };
  });
}

export async function getDashboardInvites(): Promise<DashboardInvite[]> {
  const session = await getSession();
  if (!session) return [];

  // Find user email/phone for matching
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, phone: true },
  });
  if (!user) return [];

  const userEmails = user.email ? [user.email.toLowerCase().trim()] : [];
  const userPhone = user.phone ? user.phone.trim().replace(/[\s\-().]/g, "") : null;

  const rsvps = await db.rSVP.findMany({
    where: {
      OR: [
        { userId: session.userId },
        ...(userEmails.length > 0 ? [{ guestEmail: { in: userEmails } }] : []),
        ...(userPhone ? [{ guestPhone: userPhone }] : []),
      ],
      // Exclude events they host themselves to avoid duplicates
      event: {
        hostId: { not: session.userId },
      },
    },
    include: {
      event: {
        include: {
          theme: {
            select: {
              gradientFrom: true,
              gradientTo: true,
              accentColor: true,
              coverImageUrl: true,
            },
          },
          rsvps: { select: { status: true, approved: true } },
          host: { select: { name: true, email: true, avatarUrl: true } },
          coHosts: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      },
    },
    orderBy: { event: { startAt: "desc" } },
  });

  return rsvps.map((r) => {
    const e = r.event;
    const going = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => rv.approved && rv.status === "GOING"
    ).length;
    const maybe = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => rv.approved && rv.status === "MAYBE"
    ).length;
    const pending = e.rsvps.filter(
      (rv: { status: string; approved: boolean }) => !rv.approved
    ).length;

    // Check if the current user is a co-host of this event
    const isCohost = e.coHosts
      ? e.coHosts.some(
          (ch: CoHostQueryItem) => ch.user?.id === session.userId || ch.userId === session.userId
        )
      : false;

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
      isCohost,
      host: e.host,
      coHosts: e.coHosts
        ? (e.coHosts
            .map(
              (ch: CoHostQueryItem) =>
                ch.user ||
                (ch.userId ? { id: ch.userId, name: null, email: null, avatarUrl: null } : null)
            )
            .filter(Boolean) as {
            id: string;
            name: string | null;
            email: string | null;
            avatarUrl: string | null;
          }[])
        : [],
      commentCount: e._count?.comments ?? 0,
      userRsvpStatus: r.status,
      userRsvpEditToken: r.editToken,
    };
  });
}

export async function getDashboardActivity(eventIds: string[]): Promise<DashboardActivity[]> {
  const session = await getSession();
  if (!session || eventIds.length === 0) return [];

  // SEC-1: restrict to events the caller is actually authorised to see
  const authorised = await db.event.findMany({
    where: {
      id: { in: eventIds },
      OR: [
        { hostId: session.userId },
        { coHosts: { some: { userId: session.userId } } },
        { rsvps: { some: { userId: session.userId } } },
      ],
    },
    select: { id: true },
  });

  const authorisedIds = authorised.map((e) => e.id);
  if (authorisedIds.length === 0) return [];

  return db.activityEvent.findMany({
    where: {
      eventId: { in: authorisedIds },
    },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
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
  const isCohost = field.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session?.userId
  );
  const isAdmin = session?.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  return field.answers.map((a: { value: string; rsvp: { guestName: string } }) => ({
    guestName: a.rsvp.guestName,
    value: a.value,
  }));
}

export async function inviteGuest(eventId: string, emailOrPhone: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await assertHost(eventId);

  const entries = emailOrPhone
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (entries.length === 0) {
    throw new Error("No valid emails or phone numbers provided.");
  }

  const invited: string[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const isEmail = entry.includes("@");

      // Basic input validation
      if (isEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry)) {
          throw new Error(`Invalid email: ${entry}`);
        }
      } else {
        if (!/^\+?[0-9\s\-()]{7,}$/.test(entry)) {
          throw new Error(`Invalid phone: ${entry}`);
        }
      }

      let user = await db.user.findFirst({
        where: isEmail ? { email: entry } : { phone: entry },
      });
      if (!user) {
        user = await db.user.create({
          data: isEmail ? { email: entry, role: "GUEST" } : { phone: entry, role: "GUEST" },
        });
      }

      let rsvp = await db.rSVP.findFirst({
        where: { eventId, userId: user.id },
      });

      if (!rsvp) {
        const namePrefix = isEmail ? entry.split("@")[0] : entry;
        rsvp = await db.rSVP.create({
          data: {
            eventId,
            guestName: namePrefix,
            guestEmail: isEmail ? entry : null,
            guestPhone: isEmail ? null : entry,
            status: "INVITED",
            responded: false,
            approved: true,
            userId: user.id,
          },
        });
      }

      // Prevent duplicate invitations for the same target
      const existingInvitation = await db.invitation.findFirst({
        where: { eventId, sentTo: entry },
      });

      if (!existingInvitation) {
        await db.invitation.create({
          data: {
            eventId,
            sentTo: entry,
            channel: isEmail ? "EMAIL" : "SMS",
            rsvpId: rsvp.id,
          },
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const rsvpBaseUrl = `${appUrl}/e/${event.slug}/rsvp?token=${rsvp.editToken}`;

      if (isEmail) {
        const eventDetails = await db.event.findUnique({
          where: { id: eventId },
          select: {
            title: true,
            startAt: true,
            locationName: true,
            maybeEnabled: true,
            host: { select: { name: true, email: true } },
          },
        });
        await sendEventInviteEmail(entry, {
          guestName: rsvp.guestName,
          hostName: eventDetails?.host?.name ?? session.email?.split("@")[0] ?? "Your Host",
          eventTitle: eventDetails?.title ?? "Event",
          eventSlug: event.slug,
          startAt: eventDetails?.startAt ?? new Date(),
          locationName: eventDetails?.locationName,
          rsvpBaseUrl,
          maybeEnabled: eventDetails?.maybeEnabled ?? true,
          replyTo: eventDetails?.host?.email || undefined,
        });
      } else {
        const eventDetails = await db.event.findUnique({
          where: { id: eventId },
          select: { title: true, maybeEnabled: true, host: { select: { name: true } } },
        });
        await sendEventInviteSms(entry, {
          hostName: eventDetails?.host?.name ?? session.email?.split("@")[0] ?? "Your Host",
          eventTitle: eventDetails?.title ?? "Event",
          rsvpBaseUrl,
          maybeEnabled: eventDetails?.maybeEnabled ?? true,
        });
      }

      invited.push(entry);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
    }
  }

  if (invited.length === 0) {
    throw new Error(`Failed to send invites: ${errors.join("; ")}`);
  }

  return {
    success: true,
    emailOrPhone: invited.join(", "),
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function inviteFriendAsGuest(
  eventId: string,
  editToken: string,
  emailOrPhone: string
): Promise<{ success: boolean; error?: string }> {
  // SEC-18: this action is authorized only by a guest editToken yet fans out to
  // SMTP/Twilio, so with no throttling a single token can drive unlimited
  // email/SMS to arbitrary recipients (spam/phishing under our sending
  // reputation + real Twilio cost). Reuse the shared rateLimit()/getClientIp()
  // helpers (same pattern as verifyEventPassword and auth) to bound it. The
  // per-IP burst limit is checked first so it also throttles invalid-token
  // enumeration before any DB lookup.
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`guest-invite:ip:${ip}`, 30, 3600);
  if (!ipLimit.success) {
    return { success: false, error: "Too many invites sent. Please try again later." };
  }

  const invitingRsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: { event: true },
  });
  if (!invitingRsvp || invitingRsvp.eventId !== eventId) {
    return { success: false, error: "Invalid guest token" };
  }
  if (invitingRsvp.status !== "GOING" && invitingRsvp.status !== "MAYBE") {
    return { success: false, error: "Only attending guests can invite friends" };
  }

  const event = invitingRsvp.event;
  if (event.visibility !== "PRIVATE") {
    return { success: false, error: "This feature is only for private events" };
  }
  if (!event.guestsCanInvite) {
    return { success: false, error: "Guests are not allowed to invite others to this event" };
  }

  const entry = emailOrPhone.trim();
  if (!entry) {
    return { success: false, error: "No invite target provided" };
  }

  const isEmail = entry.includes("@");
  if (isEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry)) {
      return { success: false, error: `Invalid email: ${entry}` };
    }
  } else {
    if (!/^\+?[0-9\s\-()]{7,}$/.test(entry)) {
      return { success: false, error: `Invalid phone: ${entry}` };
    }
  }

  // SEC-18: per-token burst limit + per-RSVP daily cap. Checked only after the
  // token is validated/authorized and the target is well-formed, so legitimate
  // rejections (bad token, typo'd address) don't burn the inviting guest's cap.
  const tokenLimit = await rateLimit(`guest-invite:token:${editToken}`, 10, 600);
  if (!tokenLimit.success) {
    return {
      success: false,
      error: "Too many invites sent. Please slow down and try again later.",
    };
  }
  const rsvpCap = await rateLimit(`guest-invite:rsvp:${invitingRsvp.id}`, 20, 86400);
  if (!rsvpCap.success) {
    return {
      success: false,
      error: "You've reached the maximum number of invites you can send for this event.",
    };
  }

  let user = await db.user.findFirst({
    where: isEmail ? { email: entry } : { phone: entry },
  });
  if (!user) {
    user = await db.user.create({
      data: isEmail ? { email: entry, role: "GUEST" } : { phone: entry, role: "GUEST" },
    });
  }

  let rsvp = await db.rSVP.findFirst({
    where: { eventId, userId: user.id },
  });
  if (!rsvp) {
    const namePrefix = isEmail ? entry.split("@")[0] : entry;
    rsvp = await db.rSVP.create({
      data: {
        eventId,
        guestName: namePrefix,
        guestEmail: isEmail ? entry : null,
        guestPhone: isEmail ? null : entry,
        status: "INVITED",
        responded: false,
        approved: false,
        userId: user.id,
      },
    });
  }

  const existingInvitation = await db.invitation.findFirst({
    where: { eventId, sentTo: entry },
  });
  if (!existingInvitation) {
    await db.invitation.create({
      data: {
        eventId,
        sentTo: entry,
        channel: isEmail ? "EMAIL" : "SMS",
        rsvpId: rsvp.id,
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rsvpBaseUrl = `${appUrl}/e/${event.slug}/rsvp?token=${rsvp.editToken}`;

  if (isEmail) {
    await sendEventInviteEmail(entry, {
      guestName: rsvp.guestName,
      hostName: invitingRsvp.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      startAt: event.startAt,
      locationName: event.locationName,
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled,
      replyTo: invitingRsvp.guestEmail || undefined,
    });
  } else {
    await sendEventInviteSms(entry, {
      hostName: invitingRsvp.guestName,
      eventTitle: event.title,
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled,
    });
  }

  logActivity(eventId, "guest_invite", `${invitingRsvp.guestName} invited ${rsvp.guestName}`).catch(
    () => {}
  );
  revalidatePath(`/e/${event.slug}`);

  return { success: true };
}

// ── Polls ──────────────────────────────────────────────────────────────────────

export async function createPoll(
  eventId: string,
  question: string,
  options: string[],
  multiChoice: boolean,
  allowGuestsToAdd: boolean,
  hideVoters: boolean = false
) {
  const event = await assertHostOrCohost(eventId);
  if (!question.trim()) throw new Error("Question cannot be empty");

  const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

  const poll = await db.$transaction(async (tx) => {
    const p = await tx.poll.create({
      data: {
        eventId,
        question: question.trim(),
        multiChoice,
        allowGuestsToAdd,
        hideVoters,
      },
    });

    if (cleanOptions.length > 0) {
      await tx.pollOption.createMany({
        data: cleanOptions.map((o) => ({
          pollId: p.id,
          text: o,
        })),
      });
    }

    return p;
  });

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await logActivity(
    eventId,
    "poll_create",
    `created a new poll: "${question.trim()}"`,
    hostName
  ).catch(() => null);

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: poll.id };
}

export async function deletePoll(pollId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  await db.poll.delete({
    where: { id: pollId },
  });

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function castVote(
  pollId: string,
  pollOptionId: string,
  voterName: string,
  isVoted: boolean,
  guestRsvpId?: string
) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!poll) throw new Error("Poll not found");
  if (poll.locked) throw new Error("This poll is locked");

  // Auth verification
  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  if (!isHost) {
    if (!guestRsvpId) throw new Error("Unauthorized: Guest RSVP ID required to vote");
    const rsvp = await db.rSVP.findFirst({
      where: {
        id: guestRsvpId,
        eventId: poll.eventId,
        approved: true,
      },
    });
    if (!rsvp) throw new Error("Unauthorized: RSVP not found or not approved");
    if (rsvp.guestName !== voterName) {
      throw new Error("Unauthorized: Voter name does not match guest name");
    }
  }

  const option = await db.pollOption.findUnique({
    where: { id: pollOptionId },
    select: { text: true },
  });
  if (!option) throw new Error("Option not found");

  if (isVoted) {
    if (!poll.multiChoice) {
      // Single-choice poll: delete any other votes by this voter in this poll
      await db.pollVote.deleteMany({
        where: {
          pollId,
          voterName,
        },
      });
    }

    await db.pollVote.upsert({
      where: {
        pollOptionId_voterName: {
          pollOptionId,
          voterName,
        },
      },
      create: {
        pollId,
        pollOptionId,
        voterName,
        userId: session?.userId,
      },
      update: {},
    });
  } else {
    // Retract vote
    await db.pollVote.deleteMany({
      where: {
        pollOptionId,
        voterName,
      },
    });
  }

  // Log activity if the poll is public (not anonymous)
  if (!poll.hideVoters) {
    await logActivity(
      poll.eventId,
      isVoted ? "poll_vote" : "poll_vote_retracted",
      isVoted
        ? `voted for "${option.text}" in the poll "${poll.question}"`
        : `retracted vote for "${option.text}" in the poll "${poll.question}"`,
      voterName
    ).catch(() => null);
  }

  revalidatePath(`/e/${poll.event.slug}`);
  return { success: true };
}

export async function addPollOption(
  pollId: string,
  text: string,
  creatorName: string,
  guestRsvpId?: string
) {
  if (!text.trim()) throw new Error("Option text cannot be empty");

  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      event: {
        select: {
          hostId: true,
          slug: true,
          coHosts: { select: { userId: true } },
        },
      },
    },
  });
  if (!poll) throw new Error("Poll not found");
  if (poll.locked) throw new Error("This poll is locked");

  const session = await getSession();
  const isOwner = session?.userId === poll.event.hostId;
  const isCohost = poll.event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = isOwner || isCohost;

  if (!isHost) {
    if (!poll.allowGuestsToAdd)
      throw new Error("Guests are not allowed to add options to this poll");
    if (!guestRsvpId) throw new Error("Unauthorized: Guest RSVP ID required");
    const rsvp = await db.rSVP.findFirst({
      where: {
        id: guestRsvpId,
        eventId: poll.eventId,
        approved: true,
      },
    });
    if (!rsvp) throw new Error("Unauthorized: RSVP not found or not approved");
    if (rsvp.guestName !== creatorName) {
      throw new Error("Unauthorized: Creator name does not match guest name");
    }
  }

  // Check if option already exists
  const existing = await db.pollOption.findFirst({
    where: {
      pollId,
      text: {
        equals: text.trim(),
      },
    },
  });
  if (existing) throw new Error("Option already exists");

  const option = await db.pollOption.create({
    data: {
      pollId,
      text: text.trim(),
      creatorName: isHost ? null : creatorName,
    },
  });

  await logActivity(
    poll.eventId,
    "poll_option_add",
    `added a new option "${text.trim()}" to the poll`,
    creatorName
  ).catch(() => null);

  revalidatePath(`/e/${poll.event.slug}`);
  return { success: true, id: option.id };
}

export async function updatePollSettings(
  pollId: string,
  data: {
    question?: string;
    multiChoice?: boolean;
    allowGuestsToAdd?: boolean;
    locked?: boolean;
    hideVoters?: boolean;
  }
) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true, question: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await db.poll.update({
    where: { id: pollId },
    data: {
      question: data.question !== undefined ? data.question.trim() : undefined,
      multiChoice: data.multiChoice,
      allowGuestsToAdd: data.allowGuestsToAdd,
      locked: data.locked,
      hideVoters: data.hideVoters,
    },
  });

  // Log activity for significant updates (like lock/unlock)
  if (data.locked !== undefined) {
    await logActivity(
      poll.eventId,
      data.locked ? "poll_lock" : "poll_unlock",
      `${data.locked ? "locked" : "unlocked"} the poll: "${poll.question}"`,
      hostName
    ).catch(() => null);
  }

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function deletePollOption(pollId: string, optionId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: { eventId: true, question: true },
  });
  if (!poll) throw new Error("Poll not found");

  const event = await assertHostOrCohost(poll.eventId);

  const option = await db.pollOption.findUnique({
    where: { id: optionId },
    select: { text: true },
  });
  if (!option) throw new Error("Option not found");

  await db.pollOption.delete({
    where: { id: optionId },
  });

  const session = await getSession();
  let hostName = "Host";
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    hostName = user?.name ?? user?.email?.split("@")[0] ?? "Host";
  }

  await logActivity(
    poll.eventId,
    "poll_option_delete",
    `deleted option "${option.text}" from the poll: "${poll.question}"`,
    hostName
  ).catch(() => null);

  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

// ── Public theme preset fetch (for ThemePicker / SettingsPage) ────────────────

export async function getActiveThemePresets() {
  return db.themePreset.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// Tombstones the event as DELETED and hard-deletes all guest data for GDPR compliance.
// Only the host (or admin) may delete their own event this way.
export async function deleteHostEvent(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, hostId: true, slug: true, status: true },
  });
  if (!event) throw new Error("Event not found");
  if (event.hostId !== session.userId && session.role !== "ADMIN") throw new Error("Forbidden");
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

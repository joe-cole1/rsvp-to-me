"use server";

import { eventActionMessage } from "./localization";

import { resolveLocale } from "@/i18n/config";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { sendRsvpConfirmationEmail, sendHostRsvpAlertEmail } from "@/lib/email";
import { notifyRsvp, notifyHostAlert } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { cookies } from "next/headers";
import { getUnlockSignature } from "@/lib/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { withEventCapacityLock } from "@/lib/capacityLock";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";

export async function verifyEventPassword(
  slug: string,
  rawPassword: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  await assertCaptcha("event_password", captchaToken);
  // SEC-19: throttle online brute-force of password-gated events. bcrypt slows
  // each guess but without an attempt cap an attacker can still grind a weak
  // password. Limit to 10 attempts per slug+IP per 10 minutes.
  const ip = await getClientIp();
  const limit = await rateLimit(`event-pw:${slug}:${ip}`, 10, 600);
  if (!limit.success) {
    return { success: false, error: await eventActionMessage("passwordRateLimited") };
  }

  const event = await db.event.findUnique({
    where: { slug },
    select: { passwordHash: true },
  });

  if (!event) {
    return { success: false, error: await eventActionMessage("eventNotFoundPeriod") };
  }

  const password = rawPassword.trim();
  if (!event.passwordHash || !(await bcrypt.compare(password, event.passwordHash))) {
    return { success: false, error: await eventActionMessage("incorrectPassword") };
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

// ── RSVP ──────────────────────────────────────────────────────────────────────

// SEC-37/38 tightened the RSVP schemas, and a rejected value is now a realistic
// guest typo (junk email, over-long answer) rather than only a crafted payload —
// so surface it as the inline `{ success: false, error }` shape RsvpFlow renders
// instead of a thrown ZodError the form can't catch.
async function rsvpValidationError(issues: { path: PropertyKey[] }[]): Promise<string> {
  const fields = new Set(issues.flatMap((i) => i.path.map(String)));
  if (fields.has("guestEmail")) return eventActionMessage("invalidEmail");
  if (fields.has("guestPhone")) return eventActionMessage("invalidPhone");
  if (fields.has("answers")) return eventActionMessage("answerTooLong");
  return eventActionMessage("invalidRsvp");
}

async function linkUnlinkedInvitation(
  eventId: string,
  rsvpId: string,
  guestEmail: string | undefined,
  guestPhone: string | undefined
) {
  // Some older invitations have no RSVP link. Once the invitee responds through
  // the public RSVP form, attach that history row to their RSVP so it no longer
  // appears as a separate unanswered invite in the host guest list.
  if (guestEmail) {
    await db.invitation.updateMany({
      where: {
        eventId,
        rsvpId: null,
        channel: "EMAIL",
        sentTo: { equals: guestEmail, mode: "insensitive" },
      },
      data: { rsvpId },
    });
  } else if (guestPhone) {
    const normalizedPhone = guestPhone.trim().replace(/[\s\-().]/g, "");
    await db.invitation.updateMany({
      where: { eventId, rsvpId: null, channel: "SMS", sentTo: normalizedPhone },
      data: { rsvpId },
    });
  }
}

type RsvpAlertRecipient = {
  email: string | null;
  phone: string | null;
  preferredLocale: string | null;
};

// Host "New RSVP" alerts — fire-and-forget so a notification failure never
// blocks the guest's RSVP. Per-event toggles gate each channel; the email
// alert is intentionally immune to the guest email_enabled channel toggle
// (see Guest Messaging Channel Toggles, PR #181) while the SMS alert stays
// behind sms_enabled inside sendHostRsvpAlertSms.
function sendHostRsvpAlerts(
  event: {
    id: string;
    title: string;
    slug: string;
    theme: Parameters<typeof sendHostRsvpAlertEmail>[1]["theme"];
    hostAlertEmail: boolean;
    hostAlertSms: boolean;
    host: RsvpAlertRecipient;
    coHosts: { user: RsvpAlertRecipient }[];
  },
  alert: {
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note: string | null;
  },
  source: string
) {
  if (!event.hostAlertEmail && !event.hostAlertSms) return;
  const alertBase = { ...alert, eventTitle: event.title, eventSlug: event.slug };
  (async () => {
    const counts = await db.rSVP.groupBy({
      by: ["status"],
      where: { eventId: event.id, status: { in: ["GOING", "MAYBE", "NO"] } },
      _count: { _all: true },
    });
    const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
    // One dispatcher call resolves all current organizers and their own preferences.
    await notifyHostAlert(event.id, {
      kind: "host_alert",
      id: event.id,
      options: {
        ...alertBase,
        goingCount: countFor("GOING"),
        maybeCount: countFor("MAYBE"),
        noCount: countFor("NO"),
        theme: event.theme,
      },
    });
  })().catch(logSafe(source));
}

/** Guest RSVP confirmation (with the edit link) to each contact the RSVP has. */
function sendRsvpConfirmations(
  rsvpId: string,
  opts: Parameters<typeof sendRsvpConfirmationEmail>[1],
  source: string
) {
  void notifyRsvp(rsvpId, { kind: "confirmation", id: rsvpId, options: opts }).catch(
    logSafe(source)
  );
}

export async function addRSVP(rawInput: unknown, captchaToken?: string | null) {
  const parsed = AddRsvpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: await rsvpValidationError(parsed.error.issues) };
  }
  const data = parsed.data;
  await assertCaptcha("rsvp_create", captchaToken);

  // SEC-23: addRSVP is callable by anyone on PUBLIC/UNLISTED events, upserts a
  // User from the supplied address, and fans out a confirmation email/SMS to
  // it. Without a cap that is an email/SMS bomb + Twilio-cost vector and lets an
  // attacker pre-create arbitrary User rows. Throttle before any DB write or
  // send, mirroring verifyEventPassword / inviteFriendAsGuest (SEC-18/SEC-19).
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`rsvp:ip:${ip}`, 15, 600);
  if (!ipLimit.success) {
    return { success: false, error: await eventActionMessage("rsvpRateLimited") };
  }
  const eventLimit = await rateLimit(`rsvp:evt:${data.eventId}:${ip}`, 8, 600);
  if (!eventLimit.success) {
    return { success: false, error: await eventActionMessage("eventRsvpRateLimited") };
  }

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
      endAt: true,
      timezone: true,
      locationType: true,
      locationName: true,
      locationAddress: true,
      virtualUrl: true,
      theme: true,
      hostAlertEmail: true,
      hostAlertSms: true,
      host: { select: { name: true, email: true, phone: true, preferredLocale: true } },
      coHosts: {
        select: { user: { select: { email: true, phone: true, preferredLocale: true } } },
      },
      rsvpFields: { select: { id: true } },
    },
  });
  if (!event) return { success: false, error: await eventActionMessage("eventNotFound") };
  if (event.startAt <= new Date()) {
    return { success: false, error: await eventActionMessage("eventStarted") };
  }
  if (event.rsvpDeadline && event.rsvpDeadline < new Date())
    return { success: false, error: await eventActionMessage("deadlinePassed") };

  let userId: string | undefined;
  let recipientLocale = resolveLocale(undefined);
  if (data.guestEmail) {
    const normalizedEmail = data.guestEmail.toLowerCase().trim();
    const guestUser = await db.user.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, name: data.guestName },
      update: {},
      select: { id: true, preferredLocale: true },
    });
    userId = guestUser.id;
    recipientLocale = resolveLocale(guestUser.preferredLocale);
  } else if (data.guestPhone) {
    const phone = data.guestPhone.trim().replace(/[\s\-().]/g, "");
    const guestUser = await db.user.upsert({
      where: { phone },
      create: { phone, name: data.guestName },
      update: {},
      select: { id: true, preferredLocale: true },
    });
    userId = guestUser.id;
    recipientLocale = resolveLocale(guestUser.preferredLocale);
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

  if (locked.atCapacity) return { success: false, error: await eventActionMessage("atCapacity") };
  const rsvp = locked.rsvp;

  await linkUnlinkedInvitation(
    data.eventId,
    rsvp.id,
    data.guestEmail || undefined,
    data.guestPhone || undefined
  );

  if (data.answers && Object.keys(data.answers).length > 0) {
    // SEC-38: only this event's question ids may be written — a crafted call
    // could otherwise attach answers to another event's rsvpFieldId.
    const validFieldIds = new Set(event.rsvpFields.map((f) => f.id));
    await db.rSVPAnswer.createMany({
      data: Object.entries(data.answers)
        .filter(([k, v]) => validFieldIds.has(k) && typeof v === "string" && v.trim())
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
  logActivity(data.eventId, "rsvp_new", detail, data.guestName).catch(logSafe("addRSVP"));

  sendRsvpConfirmations(
    rsvp.id,
    {
      locale: recipientLocale,
      guestName: data.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      eventId: event.id,
      status: data.status,
      editToken: rsvp.editToken,
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      locationType: event.locationType,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      virtualUrl: event.virtualUrl,
      theme: event.theme,
      replyTo: event.host.email || undefined,
    },
    "addRSVP"
  );

  sendHostRsvpAlerts(
    event,
    {
      guestName: data.guestName,
      status: data.status,
      plusOneCount: data.plusOneCount,
      note: data.note || null,
    },
    "addRSVP"
  );

  revalidatePath(`/e/${event.slug}`);
  // Typing an invitee's contact must not reveal their private link: it reaches them through
  // the confirmation sent to the contact the invitation already holds.
  return { success: true, id: rsvp.id, editToken: existingInvited ? null : rsvp.editToken };
}

// ── RSVP edit (guest) ─────────────────────────────────────────────────────────

export async function updateRSVP(
  editToken: string,
  rawInput: unknown,
  captchaToken?: string | null
) {
  const parsed = UpdateRsvpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: await rsvpValidationError(parsed.error.issues) };
  }
  const data = parsed.data;
  await assertCaptcha("rsvp_edit", captchaToken);
  const rsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: {
      checkIn: { select: { id: true } },
      user: { select: { preferredLocale: true } },
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          capacity: true,
          rsvpDeadline: true,
          startAt: true,
          endAt: true,
          timezone: true,
          locationType: true,
          locationName: true,
          locationAddress: true,
          virtualUrl: true,
          theme: true,
          hostAlertEmail: true,
          hostAlertSms: true,
          host: { select: { email: true, phone: true, preferredLocale: true } },
          coHosts: {
            select: { user: { select: { email: true, phone: true, preferredLocale: true } } },
          },
          rsvpFields: { select: { id: true } },
        },
      },
    },
  });
  if (!rsvp) return { success: false, error: await eventActionMessage("rsvpNotFound") };

  if (rsvp.event.startAt <= new Date()) {
    return { success: false, error: await eventActionMessage("eventStarted") };
  }

  // SEC-21(b): a token-holding guest could previously flip to GOING after the
  // deadline or past capacity — a capacity-bypass cousin of SEC-12. Re-validate
  // both here. Declining (NO) is always allowed so guests can cancel late.
  if (rsvp.event.rsvpDeadline && rsvp.event.rsvpDeadline < new Date() && data.status !== "NO") {
    return { success: false, error: await eventActionMessage("deadlinePassed") };
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

    // An invited guest's first answer arrives here, through their edit link.
    // The claim commits with the rest of the save: a failed save leaves the
    // answer unclaimed for a retry, and concurrent submits still notify once.
    const firstResponse = await db.$transaction(async (tx) => {
      const claimed =
        !rsvp.responded &&
        (
          await tx.rSVP.updateMany({
            where: { id: rsvp.id, responded: false },
            data: { responded: true },
          })
        ).count === 1;

      await tx.rSVP.update({
        where: { editToken },
        data: {
          status: data.status,
          ...(data.guestName !== undefined && { guestName: data.guestName }),
          plusOneCount: data.plusOneCount,
          responded: true,
          ...(data.note !== undefined && { note: data.note || null }),
        },
      });

      if (data.plusOneGuestNames !== undefined) {
        await tx.plusOneGuest.deleteMany({ where: { rsvpId: rsvp.id } });
        if (data.plusOneGuestNames.length > 0) {
          await tx.plusOneGuest.createMany({
            data: data.plusOneGuestNames
              .filter((n) => n.trim())
              .map((name, order) => ({ rsvpId: rsvp.id, name: name.trim(), order })),
          });
        }
      }

      if (data.answers && Object.keys(data.answers).length > 0) {
        // SEC-38: same event-scoped field-id check as addRSVP.
        const validFieldIds = new Set(rsvp.event.rsvpFields.map((f) => f.id));
        for (const [rsvpFieldId, value] of Object.entries(data.answers)) {
          if (!validFieldIds.has(rsvpFieldId) || typeof value !== "string" || !value.trim()) {
            continue;
          }
          await tx.rSVPAnswer.upsert({
            where: { rsvpId_rsvpFieldId: { rsvpId: rsvp.id, rsvpFieldId } },
            create: { rsvpId: rsvp.id, rsvpFieldId, value },
            update: { value },
          });
        }
      }

      if (data.status === "NO" && rsvp.checkIn) {
        await tx.checkIn.deleteMany({ where: { rsvpId: rsvp.id, eventId: rsvp.eventId } });
      }
      return claimed;
    });
    return { atCapacity: false as const, firstResponse };
  });

  if (locked.atCapacity) return { success: false, error: await eventActionMessage("atCapacity") };

  // Activity and notifications start only after the save has committed.
  if (data.status === "NO" && rsvp.checkIn) {
    logActivity(
      rsvp.eventId,
      "check_in_undo",
      `automatically undid check-in for ${data.guestName ?? rsvp.guestName} after an RSVP status change`,
      data.guestName ?? rsvp.guestName
    ).catch(logSafe("updateRSVP"));
  }

  const guestName = data.guestName ?? rsvp.guestName;
  const statusText =
    data.status === "GOING" ? "going" : data.status === "MAYBE" ? "maybe" : "not going";
  if (locked.firstResponse) {
    // Same notifications and activity as a public-page RSVP (addRSVP); the
    // confirmation goes only to the contact already on the RSVP.
    const note = (data.note !== undefined ? data.note : rsvp.note)?.trim() || null;
    const plusStr = data.plusOneCount > 0 ? ` +${data.plusOneCount}` : "";
    logActivity(
      rsvp.eventId,
      "rsvp_new",
      note
        ? `${guestName} is ${statusText}${plusStr}\n${note}`
        : `${guestName} is ${statusText}${plusStr}`,
      guestName
    ).catch(logSafe("updateRSVP"));
    const { event } = rsvp;
    sendRsvpConfirmations(
      rsvp.id,
      {
        locale: resolveLocale(rsvp.user?.preferredLocale),
        guestName,
        eventTitle: event.title,
        eventSlug: event.slug,
        eventId: event.id,
        status: data.status,
        editToken: rsvp.editToken,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        locationType: event.locationType,
        locationName: event.locationName,
        locationAddress: event.locationAddress,
        virtualUrl: event.virtualUrl,
        theme: event.theme,
        replyTo: event.host.email || undefined,
      },
      "updateRSVP"
    );
    sendHostRsvpAlerts(
      event,
      { guestName, status: data.status, plusOneCount: data.plusOneCount, note },
      "updateRSVP"
    );
  } else {
    logActivity(
      rsvp.eventId,
      "rsvp_update",
      `${guestName} updated to ${statusText}`,
      guestName
    ).catch(logSafe("updateRSVP"));
  }

  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true, rsvpId: rsvp.id };
}

export async function updateRsvpAsHost(
  rsvpId: string,
  rawInput: unknown,
  captchaToken?: string | null
) {
  const parsed = UpdateRsvpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: await rsvpValidationError(parsed.error.issues) };
  }
  const data = parsed.data;
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  await assertCaptcha("rsvp_edit", captchaToken);
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      checkIn: { select: { id: true } },
      event: { select: { id: true, slug: true, rsvpFields: { select: { id: true } } } },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);

  await db.rSVP.update({
    where: { id: rsvp.id },
    data: {
      status: data.status,
      ...(data.guestName !== undefined && { guestName: data.guestName }),
      plusOneCount: data.status === "GOING" ? data.plusOneCount : 0,
      responded: true,
      ...(data.note !== undefined && { note: data.note || null }),
    },
  });

  if (data.plusOneGuestNames !== undefined) {
    await db.plusOneGuest.deleteMany({ where: { rsvpId: rsvp.id } });
    if (data.status === "GOING" && data.plusOneGuestNames.length > 0) {
      await db.plusOneGuest.createMany({
        data: data.plusOneGuestNames
          .filter((name) => name.trim())
          .map((name, order) => ({ rsvpId: rsvp.id, name: name.trim(), order })),
      });
    }
  }

  if (data.answers && Object.keys(data.answers).length > 0) {
    const validFieldIds = new Set(rsvp.event.rsvpFields.map((field) => field.id));
    await Promise.all(
      Object.entries(data.answers)
        .filter(([id, value]) => validFieldIds.has(id) && typeof value === "string" && value.trim())
        .map(([rsvpFieldId, value]) =>
          db.rSVPAnswer.upsert({
            where: { rsvpId_rsvpFieldId: { rsvpId: rsvp.id, rsvpFieldId } },
            create: { rsvpId: rsvp.id, rsvpFieldId, value: value as string },
            update: { value: value as string },
          })
        )
    );
  }

  if (data.status === "NO" && rsvp.checkIn) {
    await db.checkIn.deleteMany({ where: { rsvpId: rsvp.id, eventId: rsvp.eventId } });
    logActivity(
      rsvp.eventId,
      "check_in_undo",
      `automatically undid check-in for ${data.guestName ?? rsvp.guestName} after an RSVP status change`,
      session.email
    ).catch(logSafe("updateRsvpAsHost"));
  }

  const statusText =
    data.status === "GOING" ? "going" : data.status === "MAYBE" ? "maybe" : "not going";
  logActivity(
    rsvp.eventId,
    "rsvp_update",
    `updated ${data.guestName ?? rsvp.guestName} to ${statusText}`,
    session.email
  ).catch(logSafe("updateRsvpAsHost"));
  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true as const, rsvpId: rsvp.id };
}

export async function deleteRsvpAsHost(rsvpId: string) {
  // SEC-42: no existence oracle — unauthenticated callers get "Unauthorized"
  // before any lookup, and a missing id throws the same "Forbidden" as an
  // unauthorized one (matching the info-section actions).
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: { select: { id: true, slug: true } } },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.event.id);
  await db.rSVP.delete({ where: { id: rsvpId } });
  logActivity(rsvp.event.id, "rsvp_delete", `${rsvp.guestName}'s RSVP was removed`).catch(
    logSafe("deleteRsvpAsHost")
  );
  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

// ── RSVP approval ─────────────────────────────────────────────────────────────

export async function approveRsvp(rsvpId: string, message?: string, captchaToken?: string | null) {
  // SEC-42: see deleteRsvpAsHost.
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  await assertCaptcha("rsvp_moderation", captchaToken);
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      user: { select: { preferredLocale: true } },
      event: {
        select: {
          slug: true,
          title: true,
          theme: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);

  await db.rSVP.update({ where: { id: rsvpId }, data: { approved: true } });

  await notifyRsvp(rsvp.id, {
    kind: "approval",
    id: rsvp.id,
    options: {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: true,
      message,
      theme: rsvp.event.theme,
      replyTo: rsvp.event.host.email || undefined,
    },
  }).catch(logSafe("approveRsvp"));

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function declineRsvp(rsvpId: string, message?: string, captchaToken?: string | null) {
  // SEC-42: see deleteRsvpAsHost.
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  await assertCaptcha("rsvp_moderation", captchaToken);
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      user: { select: { preferredLocale: true } },
      event: {
        select: {
          slug: true,
          title: true,
          theme: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);

  await notifyRsvp(rsvp.id, {
    kind: "approval",
    id: rsvp.id,
    options: {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: false,
      message,
      theme: rsvp.event.theme,
      replyTo: rsvp.event.host.email || undefined,
    },
  }).catch(logSafe("declineRsvp"));

  await db.rSVP.delete({ where: { id: rsvpId } });
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendRsvpConfirmationEmail, sendApprovalEmail } from "@/lib/email";
import { sendRsvpConfirmationSms, sendApprovalSms } from "@/lib/sms";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { cookies } from "next/headers";
import { getUnlockSignature } from "@/lib/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { withEventCapacityLock } from "@/lib/capacityLock";
import bcrypt from "bcryptjs";
import { assertHostOrCohost } from "./shared";

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

// ── RSVP ──────────────────────────────────────────────────────────────────────

export async function addRSVP(rawInput: unknown) {
  const data = AddRsvpSchema.parse(rawInput);

  // SEC-23: addRSVP is callable by anyone on PUBLIC/UNLISTED events, upserts a
  // User from the supplied address, and fans out a confirmation email/SMS to
  // it. Without a cap that is an email/SMS bomb + Twilio-cost vector and lets an
  // attacker pre-create arbitrary User rows. Throttle before any DB write or
  // send, mirroring verifyEventPassword / inviteFriendAsGuest (SEC-18/SEC-19).
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`rsvp:ip:${ip}`, 15, 600);
  if (!ipLimit.success) {
    return { success: false, error: "Too many RSVPs. Please try again later." };
  }
  const eventLimit = await rateLimit(`rsvp:evt:${data.eventId}:${ip}`, 8, 600);
  if (!eventLimit.success) {
    return { success: false, error: "Too many RSVPs for this event. Please try again later." };
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
  logActivity(data.eventId, "rsvp_new", detail, data.guestName).catch(logSafe("addRSVP"));

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
    }).catch(logSafe("addRSVP"));
  }
  if (data.guestPhone) {
    sendRsvpConfirmationSms(data.guestPhone, {
      guestName: data.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      status: data.status,
      editToken: rsvp.editToken,
    }).catch(logSafe("addRSVP"));
  }

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: rsvp.id, editToken: rsvp.editToken };
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
  ).catch(logSafe("updateRSVP"));

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true, rsvpId: rsvp.id };
}

export async function deleteRsvpAsHost(rsvpId: string) {
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: { select: { id: true, slug: true } } },
  });
  if (!rsvp) throw new Error("Not found");
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

export async function approveRsvp(rsvpId: string, message?: string) {
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        select: {
          slug: true,
          title: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error("Not found");
  await assertHostOrCohost(rsvp.eventId);

  await db.rSVP.update({ where: { id: rsvpId }, data: { approved: true } });

  if (rsvp.guestEmail) {
    await sendApprovalEmail(rsvp.guestEmail, {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: true,
      message,
      replyTo: rsvp.event.host.email || undefined,
    }).catch(logSafe("approveRsvp"));
  } else if (rsvp.guestPhone) {
    await sendApprovalSms(rsvp.guestPhone, {
      eventTitle: rsvp.event.title,
      approved: true,
      message,
    }).catch(logSafe("approveRsvp"));
  }

  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

export async function declineRsvp(rsvpId: string, message?: string) {
  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    include: {
      event: {
        select: {
          slug: true,
          title: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error("Not found");
  await assertHostOrCohost(rsvp.eventId);

  if (rsvp.guestEmail) {
    await sendApprovalEmail(rsvp.guestEmail, {
      guestName: rsvp.guestName,
      eventTitle: rsvp.event.title,
      eventSlug: rsvp.event.slug,
      approved: false,
      message,
      replyTo: rsvp.event.host.email || undefined,
    }).catch(logSafe("declineRsvp"));
  } else if (rsvp.guestPhone) {
    await sendApprovalSms(rsvp.guestPhone, {
      eventTitle: rsvp.event.title,
      approved: false,
      message,
    }).catch(logSafe("declineRsvp"));
  }

  await db.rSVP.delete({ where: { id: rsvpId } });
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true };
}

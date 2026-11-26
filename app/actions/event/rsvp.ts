"use server";

import { eventActionMessage } from "./localization";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyRsvp } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { cookies } from "next/headers";
import { getUnlockSignature } from "@/lib/crypto";
import { hashToken } from "@/lib/hash";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { createGuestRsvp, updateGuestRsvp, type RsvpFailure } from "@/lib/rsvp-service";
import { normalizePhone } from "@/lib/phone";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";
import { requestRsvpContactProof, verifyRsvpContactProof } from "@/lib/rsvp-contact-proof";
import { readPollVoterTokenHash } from "@/lib/poll-voter-token";
import { isFieldVisibleForRsvpStatus, validateRsvpFieldAnswer } from "@/lib/rsvp-fields";

export async function requestRsvpVerification(input: unknown, captchaToken?: string | null) {
  await assertCaptcha("rsvp_create", captchaToken);
  const result = await requestRsvpContactProof(input);
  if (!result.success)
    return { success: false as const, error: await eventActionMessage(result.reason) };
  return result;
}

export async function verifyRsvpVerification(input: unknown) {
  const result = await verifyRsvpContactProof(input);
  if (!result.success)
    return { success: false as const, error: await eventActionMessage(result.reason) };
  return result;
}

export async function verifyEventPassword(
  slug: string,
  rawPassword: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  await assertCaptcha("event_password", captchaToken);
  // SEC-19: throttle online brute-force of password-gated events. bcrypt slows
  // each guess but without an attempt cap an attacker can still grind a weak
  // password. Limit to 10 attempts per slug+IP per 10 minutes.
  // With no trusted IP, retain an explicit per-event brute-force cap. Never
  // substitute a client-minted cookie/header for a trustworthy IP identity.
  const key = isTrustedIpConfigured()
    ? `event-pw:${slug}:${await getClientIp()}`
    : `event-pw:${slug}:shared`;
  const limit = await rateLimit(key, 10, 600);
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
  const signature = getUnlockSignature(slug, event.passwordHash);

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

export async function addRSVP(
  rawInput: unknown,
  captchaToken?: string | null,
  contactProofs?: unknown
) {
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
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    if (!(await rateLimit(`rsvp:ip:${ip}`, 15, 600)).success) {
      return { success: false, error: await eventActionMessage("rsvpRateLimited") };
    }
    if (!(await rateLimit(`rsvp:evt:${data.eventId}:${ip}`, 8, 600)).success) {
      return { success: false, error: await eventActionMessage("eventRsvpRateLimited") };
    }
  }
  // Bound delivery to every supplied destination, including when both contacts
  // are present. Match the normalization used for account lookup and delivery.
  const contacts = [
    data.guestEmail ? `email:${data.guestEmail}` : null,
    data.guestPhone ? `phone:${normalizePhone(data.guestPhone)}` : null,
  ].filter((contact): contact is string => contact !== null);
  for (const contact of contacts) {
    const id = hashToken(contact);
    if (!(await rateLimit(`rsvp:contact:${id}`, 15, 600)).success) {
      return { success: false, error: await eventActionMessage("rsvpRateLimited") };
    }
    if (!(await rateLimit(`rsvp:evt-contact:${data.eventId}:${id}`, 8, 600)).success) {
      return { success: false, error: await eventActionMessage("eventRsvpRateLimited") };
    }
  }

  const result = await createGuestRsvp(data, contactProofs);
  if (!result.success)
    return {
      success: false as const,
      error: await rsvpFailureMessage(result.reason),
      ...(result.reason === "rsvpProofRequired" && { verificationRequired: true as const }),
    };

  const voterTokenHash = await readPollVoterTokenHash();
  if (voterTokenHash) {
    await (async () => {
      const existingRsvpVotes = await db.pollVote.findMany({
        where: { rsvpId: result.id, poll: { eventId: data.eventId } },
        select: { pollOptionId: true },
      });
      const existingOptionIds = existingRsvpVotes.map((v) => v.pollOptionId);
      if (existingOptionIds.length > 0) {
        await db.pollVote.deleteMany({
          where: {
            voterTokenHash,
            rsvpId: null,
            pollOptionId: { in: existingOptionIds },
          },
        });
      }
      await db.pollVote.updateMany({
        where: {
          voterTokenHash,
          rsvpId: null,
          poll: { eventId: data.eventId },
        },
        data: {
          rsvpId: result.id,
          voterTokenHash: null,
          voterName: data.guestName,
        },
      });
    })().catch(logSafe("addRSVP:linkPollVotes"));
  }

  revalidatePath(`/e/${result.slug}`);
  return { success: true as const, id: result.id, editToken: result.editToken };
}

// ── RSVP edit (guest) ─────────────────────────────────────────────────────────
export async function updateRSVP(
  editToken: string,
  rawInput: unknown,
  captchaToken?: string | null
) {
  const parsed = UpdateRsvpSchema.safeParse(rawInput);
  if (!parsed.success)
    return { success: false as const, error: await rsvpValidationError(parsed.error.issues) };
  await assertCaptcha("rsvp_edit", captchaToken);
  const result = await updateGuestRsvp(editToken, parsed.data);
  if (!result.success)
    return { success: false as const, error: await rsvpFailureMessage(result.reason) };
  revalidatePath(`/e/${result.slug}/guests`);
  revalidatePath(`/e/${result.slug}`);
  return { success: true as const, rsvpId: result.rsvpId };
}

async function rsvpFailureMessage(reason: RsvpFailure) {
  return eventActionMessage(reason === "maybeDisabled" ? "invalidRsvp" : reason);
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
      event: {
        select: {
          id: true,
          slug: true,
          rsvpEnabled: true,
          rsvpFields: {
            select: { id: true, fieldType: true, required: true, goingOnly: true, options: true },
          },
        },
      },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);
  if (rsvp.event.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }

  const normalizedAnswers: Record<string, string> = {};
  const clearedFieldIds: string[] = [];
  for (const field of rsvp.event.rsvpFields) {
    if (!isFieldVisibleForRsvpStatus(field, data.status)) {
      clearedFieldIds.push(field.id);
      continue;
    }
    if (!data.answers || !(field.id in data.answers)) continue;
    const validated = validateRsvpFieldAnswer(
      { ...field, required: false },
      data.answers[field.id]
    );
    if (!validated.valid) {
      return { success: false as const, error: await eventActionMessage(validated.reason) };
    }
    if (validated.normalized === null) {
      clearedFieldIds.push(field.id);
    } else {
      normalizedAnswers[field.id] = validated.normalized;
    }
  }

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

  await Promise.all(
    Object.entries(normalizedAnswers).map(([rsvpFieldId, value]) =>
      db.rSVPAnswer.upsert({
        where: { rsvpId_rsvpFieldId: { rsvpId: rsvp.id, rsvpFieldId } },
        create: { rsvpId: rsvp.id, rsvpFieldId, value },
        update: { value },
      })
    )
  );
  if (clearedFieldIds.length > 0 && typeof db.rSVPAnswer.deleteMany === "function") {
    await db.rSVPAnswer.deleteMany({
      where: { rsvpId: rsvp.id, rsvpFieldId: { in: clearedFieldIds } },
    });
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
    include: { event: { select: { id: true, slug: true, rsvpEnabled: true } } },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.event.id);
  if (rsvp.event.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }
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
          rsvpEnabled: true,
          theme: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);
  if (rsvp.event.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }

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
          rsvpEnabled: true,
          theme: true,
          host: { select: { email: true } },
        },
      },
    },
  });
  if (!rsvp) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(rsvp.eventId);
  if (rsvp.event.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }

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

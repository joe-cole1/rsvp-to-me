"use server";

import { eventActionMessage } from "./localization";

import { resolveLocale, type Locale } from "@/i18n/config";
import { getTranslator, getRequestTranslator } from "@/i18n/server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendEventInviteEmail } from "@/lib/email";
import { sendEventInviteSms } from "@/lib/sms";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";
import { getChannelConfig } from "@/lib/config";
import {
  parseInvitationDraft,
  isValidInvitationName,
  normalizeInvitationContact,
  type InvitationRecipient,
} from "@/lib/invitation-draft";
import {
  validateInvitationRecipients,
  resolveInvitationRecipients,
  type ResolvedInvitationRecipient,
} from "@/lib/invitation-recipients";
import type { InvitationSendResult, ReviewedInvitationRecipient } from "@/lib/invitation-types";
import type { Prisma } from "@/app/generated/prisma/client";
import { InvitationStateError } from "@/lib/invitation-recipients";

async function unnamedGuestLabel() {
  return (await getRequestTranslator())("Ui.Event.InvitationComposer.unnamedGuest");
}

async function validateInput(raw: unknown, reviewed: true): Promise<ReviewedInvitationRecipient[]>;
async function validateInput(raw: unknown): Promise<InvitationRecipient[]>;
async function validateInput(raw: unknown, reviewed?: true) {
  try {
    return reviewed ? validateInvitationRecipients(raw, true) : validateInvitationRecipients(raw);
  } catch {
    throw new Error(await eventActionMessage("invalidInvitationRecipients"));
  }
}

async function hostLimits(userId: string, eventId: string) {
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    if (!(await rateLimit(`host-invite:ip:${ip}`, 15, 3600)).success) {
      throw new Error(await eventActionMessage("inviteRateLimited"));
    }
  }
  if (!(await rateLimit(`host-invite:${userId}:${eventId}`, 10, 3600)).success) {
    throw new Error(await eventActionMessage("eventInviteRateLimited"));
  }
}

async function prepareInvitationRsvpInTransaction(
  eventId: string,
  recipient: InvitationRecipient,
  resolved: ResolvedInvitationRecipient,
  approved: boolean,
  client: Pick<Prisma.TransactionClient, "rSVP" | "invitation" | "user">
) {
  if (resolved.preview.disposition === "conflict") {
    throw new InvitationStateError("invitationConflict");
  }
  const isEmail = recipient.contact.includes("@");
  let locale: Locale;
  let rsvp;
  if (resolved.rsvp) {
    // Reuse the event contact match even when it has never been associated to a User.
    rsvp = await client.rSVP.findFirst({
      where: { id: resolved.rsvp.id, eventId },
      include: { user: { select: { preferredLocale: true } } },
    });
    if (!rsvp) throw new InvitationStateError("invitationReviewChanged");
    if (
      rsvp.guestName !== resolved.rsvp.guestName ||
      rsvp.status !== resolved.rsvp.status ||
      rsvp.responded !== resolved.rsvp.responded ||
      normalizeInvitationContact((isEmail ? rsvp.guestEmail : rsvp.guestPhone) ?? "") !==
        recipient.contact
    ) {
      throw new InvitationStateError("invitationReviewChanged");
    }
    locale = resolveLocale(rsvp.user?.preferredLocale);
  } else {
    let user = await client.user.findFirst({
      where: isEmail
        ? { email: { equals: recipient.contact, mode: "insensitive" } }
        : { phone: recipient.contact },
    });
    if (!user) {
      // Host-supplied event names must never change account-wide identity.
      user = await client.user.create({
        data: isEmail
          ? { email: recipient.contact, role: "GUEST" }
          : { phone: recipient.contact, role: "GUEST" },
      });
    }
    locale = resolveLocale(user.preferredLocale);
    rsvp = await client.rSVP.create({
      data: {
        eventId,
        guestName: resolved.preview.guestName,
        guestEmail: isEmail ? recipient.contact : null,
        guestPhone: isEmail ? null : recipient.contact,
        status: "INVITED",
        responded: false,
        approved,
        userId: user.id,
      },
    });
  }
  if (resolved.invitationIds.length === 0) {
    await client.invitation.create({
      data: {
        eventId,
        sentTo: recipient.contact,
        channel: isEmail ? "EMAIL" : "SMS",
        rsvpId: rsvp.id,
      },
    });
  } else {
    // Repair orphaned delivery history only within this event and contact's matching ids.
    await client.invitation.updateMany({
      where: { eventId, id: { in: resolved.invitationIds }, rsvpId: null },
      data: { rsvpId: rsvp.id },
    });
  }
  return { rsvp, locale };
}

async function prepareLockedInvitation(
  eventId: string,
  recipient: InvitationRecipient,
  approved: boolean,
  reviewed?: ReviewedInvitationRecipient
) {
  const unnamedGuest = await unnamedGuestLabel();
  return db.$transaction(async (client) => {
    // Transaction-scoped locks are shared by reviewed host sends and guest sends.
    // Parameterized values cannot become SQL, and distinct contacts can proceed independently.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invitation:" + eventId}), hashtext(${recipient.contact}))`;
    const [resolved] = await resolveInvitationRecipients(
      eventId,
      [recipient],
      unnamedGuest,
      client
    );
    if (resolved.preview.disposition === "conflict")
      throw new InvitationStateError("invitationConflict");
    if (
      reviewed &&
      (resolved.preview.disposition !== reviewed.expectedDisposition ||
        resolved.preview.guestName !== reviewed.expectedGuestName)
    ) {
      throw new InvitationStateError("invitationReviewChanged");
    }
    return prepareInvitationRsvpInTransaction(eventId, recipient, resolved, approved, client);
  });
}

async function deliverHostInvitation(
  eventId: string,
  recipient: InvitationRecipient,
  prepared: Awaited<ReturnType<typeof prepareLockedInvitation>>
) {
  const { rsvp, locale } = prepared;
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { theme: true, host: { select: { name: true, email: true } } },
  });
  if (!event) throw new Error(await eventActionMessage("forbidden"));
  const t = await getTranslator(locale);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rsvpBaseUrl = `${appUrl}/e/${event.slug}/rsvp?token=${rsvp.editToken}`;
  const hostName =
    event.hostDisplayName ??
    event.host?.name ??
    event.host?.email?.split("@")[0] ??
    t("Email.yourHostCapital");
  if (recipient.contact.includes("@")) {
    await sendEventInviteEmail(recipient.contact, {
      locale,
      guestName: rsvp.guestName,
      hostName,
      eventTitle: event.title ?? t("Email.eventFallback"),
      eventSlug: event.slug,
      eventId,
      startAt: event.startAt ?? new Date(),
      endAt: event.endAt,
      timezone: event.timezone,
      locationType: event.locationType,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      virtualUrl: event.virtualUrl,
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled ?? true,
      theme: event.theme,
      replyTo: event.host?.email || undefined,
    });
  } else {
    await sendEventInviteSms(recipient.contact, {
      locale,
      hostName,
      eventTitle: event.title ?? t("Email.eventFallback"),
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled ?? true,
    });
  }
  return rsvp.guestName;
}

function recordHostInvites(eventId: string, email: string | undefined | null, count: number) {
  if (count === 0) return;
  const hostLabel = email?.split("@")[0] ?? "A host";
  logActivity(
    eventId,
    "guest_invite",
    `${hostLabel} invited ${count} guest${count === 1 ? "" : "s"}`,
    hostLabel
  ).catch(logSafe("sendGuestInvitations"));
}

export async function previewGuestInvitations(eventId: string, recipients: unknown) {
  await assertHostOrCohost(eventId);
  const currentEvent = await db.event.findUnique({
    where: { id: eventId },
    select: { rsvpEnabled: true },
  });
  if (currentEvent?.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }
  const validated = await validateInput(recipients);
  const resolved = await resolveInvitationRecipients(eventId, validated, await unnamedGuestLabel());
  return { recipients: resolved.map(({ preview }) => preview) };
}

export async function sendGuestInvitations(
  eventId: string,
  recipients: unknown,
  captchaToken?: string | null
): Promise<InvitationSendResult> {
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  const event = await assertHostOrCohost(eventId);
  const currentEvent = await db.event.findUnique({
    where: { id: eventId },
    select: { rsvpEnabled: true },
  });
  if (currentEvent?.rsvpEnabled === false) {
    throw new Error(await eventActionMessage("rsvpsDisabled"));
  }
  const validated = await validateInput(recipients, true);
  await assertCaptcha("host_invite", captchaToken);
  await hostLimits(session.userId, eventId);
  const results: InvitationSendResult["results"] = [];
  for (const recipient of validated) {
    try {
      const channels = await getChannelConfig();
      if (!(recipient.contact.includes("@") ? channels.email : channels.sms)) {
        throw new InvitationStateError("invitationChannelDisabled");
      }
      const prepared = await prepareLockedInvitation(eventId, recipient, true, recipient);
      const guestName = await deliverHostInvitation(eventId, recipient, prepared);
      results.push({ contact: recipient.contact, status: "sent", guestName });
    } catch (error) {
      // Only explicitly generated domain errors cross this boundary. Delivery errors
      // may contain SMTP details or private provider data and are intentionally generic.
      results.push({
        contact: recipient.contact,
        status: "failed",
        error:
          error instanceof InvitationStateError
            ? await eventActionMessage(error.code)
            : await eventActionMessage("invitationSendFailed"),
      });
    }
  }
  const sent = results.filter((result) => result.status === "sent").length;
  recordHostInvites(eventId, session.email, sent);
  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/guests`);
  return { success: sent > 0, results };
}

export async function deleteInvitationAsHost(invitationId: string) {
  // Match RSVP deletion's SEC-42 pattern: authenticate before looking up the
  // caller-supplied id, then make missing and unauthorized records indistinct.
  const session = await getSession();
  if (!session) throw new Error(await eventActionMessage("unauthorized"));
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    include: { event: { select: { id: true, slug: true } } },
  });
  if (!invitation) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(invitation.event.id);
  if (invitation.rsvpId) throw new Error(await eventActionMessage("forbidden"));

  await db.invitation.delete({ where: { id: invitation.id } });
  revalidatePath(`/e/${invitation.event.slug}/guests`);
  revalidatePath(`/e/${invitation.event.slug}`);
  return { success: true as const };
}

export async function inviteFriendAsGuest(
  eventId: string,
  editToken: string,
  emailOrPhone: string,
  captchaToken?: string | null,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  await assertCaptcha("guest_invite", captchaToken);
  // SEC-18: this action is authorized only by a guest editToken yet fans out to
  // SMTP/Twilio, so with no throttling a single token can drive unlimited
  // email/SMS to arbitrary recipients (spam/phishing under our sending
  // reputation + real Twilio cost). Reuse the shared rateLimit()/getClientIp()
  // helpers (same pattern as verifyEventPassword and auth) to bound it. The
  // per-IP burst limit is checked first so it also throttles invalid-token
  // enumeration before any DB lookup.
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    const ipLimit = await rateLimit(`guest-invite:ip:${ip}`, 30, 3600);
    if (!ipLimit.success) {
      return { success: false, error: await eventActionMessage("inviteRateLimited") };
    }
  }

  const invitingRsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: { event: { include: { theme: true } } },
  });
  if (!invitingRsvp || invitingRsvp.eventId !== eventId) {
    return { success: false, error: await eventActionMessage("invalidGuestToken") };
  }
  if (invitingRsvp.status !== "GOING" && invitingRsvp.status !== "MAYBE") {
    return { success: false, error: await eventActionMessage("attendingInviteRequired") };
  }

  const event = invitingRsvp.event;
  if (event.rsvpEnabled === false) {
    return { success: false, error: await eventActionMessage("rsvpsDisabled") };
  }
  if (event.visibility !== "PRIVATE") {
    return { success: false, error: await eventActionMessage("privateEventRequired") };
  }
  if (!event.guestsCanInvite) {
    return { success: false, error: await eventActionMessage("guestInvitesDisabled") };
  }

  const draft = typeof emailOrPhone === "string" ? parseInvitationDraft(emailOrPhone) : null;
  if (
    !draft ||
    draft.rawCount !== 1 ||
    draft.issues.length !== 0 ||
    draft.entries.length !== 1 ||
    (name !== undefined && (typeof name !== "string" || !isValidInvitationName(name)))
  ) {
    return { success: false, error: await eventActionMessage("invalidInvitationRecipients") };
  }
  const parsedRecipient = draft.entries[0];
  if (
    name !== undefined &&
    parsedRecipient.name !== undefined &&
    name.trim() !== parsedRecipient.name
  ) {
    return { success: false, error: await eventActionMessage("invalidInvitationRecipients") };
  }
  const recipient: InvitationRecipient = {
    contact: parsedRecipient.contact,
    ...(name !== undefined
      ? { name: name.trim() }
      : parsedRecipient.name !== undefined
        ? { name: parsedRecipient.name }
        : {}),
  };
  const entry = recipient.contact;
  const isEmail = entry.includes("@");
  // SEC-18: per-token burst limit + per-RSVP daily cap. Checked only after the
  // token is validated/authorized and the target is well-formed, so legitimate
  // rejections (bad token, typo'd address) don't burn the inviting guest's cap.
  const tokenLimit = await rateLimit(`guest-invite:token:${editToken}`, 10, 600);
  if (!tokenLimit.success) {
    return {
      success: false,
      error: await eventActionMessage("inviteBurstLimited"),
    };
  }
  const rsvpCap = await rateLimit(`guest-invite:rsvp:${invitingRsvp.id}`, 20, 86400);
  if (!rsvpCap.success) {
    return {
      success: false,
      error: await eventActionMessage("inviteDailyLimited"),
    };
  }

  const target = entry;
  let prepared: Awaited<ReturnType<typeof prepareLockedInvitation>>;
  try {
    prepared = await prepareLockedInvitation(eventId, recipient, false);
  } catch (error) {
    if (error instanceof InvitationStateError)
      return { success: false, error: await eventActionMessage(error.code) };
    throw error;
  }
  const { rsvp, locale } = prepared;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rsvpBaseUrl = `${appUrl}/e/${event.slug}/rsvp?token=${rsvp.editToken}`;

  if (isEmail) {
    await sendEventInviteEmail(entry, {
      locale: locale,
      guestName: rsvp.guestName,
      hostName: invitingRsvp.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      eventId: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      locationType: event.locationType,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      virtualUrl: event.virtualUrl,
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled,
      theme: event.theme,
      replyTo: invitingRsvp.guestEmail || undefined,
    });
  } else {
    await sendEventInviteSms(target, {
      locale: locale,
      hostName: invitingRsvp.guestName,
      eventTitle: event.title,
      rsvpBaseUrl,
      maybeEnabled: event.maybeEnabled,
    });
  }

  logActivity(eventId, "guest_invite", `${invitingRsvp.guestName} invited ${rsvp.guestName}`).catch(
    logSafe("inviteFriendAsGuest")
  );
  revalidatePath(`/e/${event.slug}`);

  return { success: true };
}

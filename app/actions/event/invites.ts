"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendEventInviteEmail } from "@/lib/email";
import { sendEventInviteSms } from "@/lib/sms";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { assertHostOrCohost } from "./shared";
import { normalizePhone } from "@/lib/auth";

export async function inviteGuest(eventId: string, emailOrPhone: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await assertHostOrCohost(eventId);

  const entries = emailOrPhone
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (entries.length === 0) {
    throw new Error("No valid emails or phone numbers provided.");
  }

  // SEC-29: inviteGuest fans out email/SMS per recipient with no bound. Even
  // though it is host-authorized, an abusive or hijacked host session could
  // drive large spam blasts and Twilio cost. Cap the batch size and throttle
  // per host+event and per IP, mirroring inviteFriendAsGuest (SEC-18). The
  // per-recipient duplicate-invitation guard below further limits repeats.
  const MAX_INVITE_BATCH = 200;
  if (entries.length > MAX_INVITE_BATCH) {
    throw new Error(`Too many recipients in one request (max ${MAX_INVITE_BATCH}).`);
  }
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`host-invite:ip:${ip}`, 15, 3600);
  if (!ipLimit.success) {
    throw new Error("Too many invites sent. Please try again later.");
  }
  const eventLimit = await rateLimit(`host-invite:${session.userId}:${eventId}`, 10, 3600);
  if (!eventLimit.success) {
    throw new Error("Too many invites sent for this event. Please try again later.");
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

      const target = isEmail ? entry : normalizePhone(entry);

      let user = await db.user.findFirst({
        where: isEmail ? { email: entry } : { phone: target },
      });
      if (!user) {
        user = await db.user.create({
          data: isEmail ? { email: entry, role: "GUEST" } : { phone: target, role: "GUEST" },
        });
      }

      let rsvp = await db.rSVP.findFirst({
        where: { eventId, userId: user.id },
      });

      if (!rsvp) {
        const namePrefix = isEmail ? entry.split("@")[0] : target;
        rsvp = await db.rSVP.create({
          data: {
            eventId,
            guestName: namePrefix,
            guestEmail: isEmail ? entry : null,
            guestPhone: isEmail ? null : target,
            status: "INVITED",
            responded: false,
            approved: true,
            userId: user.id,
          },
        });
      }

      // Prevent duplicate invitations for the same target
      const existingInvitation = await db.invitation.findFirst({
        where: { eventId, sentTo: target },
      });

      if (!existingInvitation) {
        await db.invitation.create({
          data: {
            eventId,
            sentTo: target,
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
            endAt: true,
            timezone: true,
            locationType: true,
            locationName: true,
            locationAddress: true,
            virtualUrl: true,
            maybeEnabled: true,
            theme: true,
            hostDisplayName: true,
            host: { select: { name: true, email: true } },
          },
        });
        await sendEventInviteEmail(entry, {
          guestName: rsvp.guestName,
          hostName:
            eventDetails?.hostDisplayName ??
            eventDetails?.host?.name ??
            session.email?.split("@")[0] ??
            "Your Host",
          eventTitle: eventDetails?.title ?? "Event",
          eventSlug: event.slug,
          eventId,
          startAt: eventDetails?.startAt ?? new Date(),
          endAt: eventDetails?.endAt,
          timezone: eventDetails?.timezone,
          locationType: eventDetails?.locationType,
          locationName: eventDetails?.locationName,
          locationAddress: eventDetails?.locationAddress,
          virtualUrl: eventDetails?.virtualUrl,
          rsvpBaseUrl,
          maybeEnabled: eventDetails?.maybeEnabled ?? true,
          theme: eventDetails?.theme,
          replyTo: eventDetails?.host?.email || undefined,
        });
      } else {
        const eventDetails = await db.event.findUnique({
          where: { id: eventId },
          select: {
            title: true,
            maybeEnabled: true,
            hostDisplayName: true,
            host: { select: { name: true } },
          },
        });
        await sendEventInviteSms(target, {
          hostName:
            eventDetails?.hostDisplayName ??
            eventDetails?.host?.name ??
            session.email?.split("@")[0] ??
            "Your Host",
          eventTitle: eventDetails?.title ?? "Event",
          rsvpBaseUrl,
          maybeEnabled: eventDetails?.maybeEnabled ?? true,
        });
      }

      invited.push(target);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
    }
  }

  if (invited.length === 0) {
    throw new Error(`Failed to send invites: ${errors.join("; ")}`);
  }

  // SEC-46: attribute host/co-host invite issuance in the activity log. Without
  // this, invites sent via inviteGuest were the only invite path with no audit
  // trail (inviteFriendAsGuest already logs), leaving co-host-driven invite
  // blasts unattributable. Fire-and-forget with logSafe, matching addRSVP.
  const hostLabel = session.email?.split("@")[0] ?? "A host";
  logActivity(
    eventId,
    "guest_invite",
    `${hostLabel} invited ${invited.length} guest${invited.length === 1 ? "" : "s"}`,
    hostLabel
  ).catch(logSafe("inviteGuest"));

  return {
    success: true,
    emailOrPhone: invited.join(", "),
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function deleteInvitationAsHost(invitationId: string) {
  // Match RSVP deletion's SEC-42 pattern: authenticate before looking up the
  // caller-supplied id, then make missing and unauthorized records indistinct.
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    include: { event: { select: { id: true, slug: true } } },
  });
  if (!invitation) throw new Error("Forbidden");
  await assertHostOrCohost(invitation.event.id);
  if (invitation.rsvpId) throw new Error("Forbidden");

  await db.invitation.delete({ where: { id: invitation.id } });
  revalidatePath(`/e/${invitation.event.slug}/guests`);
  revalidatePath(`/e/${invitation.event.slug}`);
  return { success: true as const };
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
    include: { event: { include: { theme: true } } },
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

  const target = isEmail ? entry : normalizePhone(entry);

  let user = await db.user.findFirst({
    where: isEmail ? { email: entry } : { phone: target },
  });
  if (!user) {
    user = await db.user.create({
      data: isEmail ? { email: entry, role: "GUEST" } : { phone: target, role: "GUEST" },
    });
  }

  let rsvp = await db.rSVP.findFirst({
    where: { eventId, userId: user.id },
  });
  if (!rsvp) {
    const namePrefix = isEmail ? entry.split("@")[0] : target;
    rsvp = await db.rSVP.create({
      data: {
        eventId,
        guestName: namePrefix,
        guestEmail: isEmail ? entry : null,
        guestPhone: isEmail ? null : target,
        status: "INVITED",
        responded: false,
        approved: false,
        userId: user.id,
      },
    });
  }

  const existingInvitation = await db.invitation.findFirst({
    where: { eventId, sentTo: target },
  });
  if (!existingInvitation) {
    await db.invitation.create({
      data: {
        eventId,
        sentTo: target,
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

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendEventInviteEmail } from "@/lib/email";
import { sendEventInviteSms } from "@/lib/sms";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { assertHostOrCohost } from "./shared";

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

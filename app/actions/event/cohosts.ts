"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashToken } from "@/lib/hash";
import { sendCoHostInviteEmail } from "@/lib/email";
import { assertHost, assertHostOrCohost } from "./shared";

// ── Co-hosts ──────────────────────────────────────────────────────────────────

export async function addCoHost(eventId: string, email: string) {
  await assertHost(eventId);
  const session = await getSession();

  const normalizedEmail = email.toLowerCase().trim();

  // Check if they are inviting themselves
  if (normalizedEmail === session?.email?.toLowerCase().trim()) {
    return { success: false, error: "You are already the host" };
  }

  // Fetch full event info for sending email
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      host: { select: { name: true } },
      theme: true,
      coHosts: { include: { user: { select: { email: true } } } },
    },
  });
  if (!event) return { success: false, error: "Event not found" };

  // Check if already a co-host
  const alreadyCohost = event.coHosts.some(
    (ch) => ch.user.email?.toLowerCase().trim() === normalizedEmail
  );
  if (alreadyCohost) {
    return { success: false, error: "Already a co-host" };
  }

  // Check if already invited
  const existingInvite = await db.coHostInvitation.findFirst({
    where: { eventId, email: normalizedEmail },
  });
  if (existingInvite) {
    return { success: false, error: "Already invited" };
  }

  // Create co-host invitation
  const token = randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const invite = await db.coHostInvitation.create({
    data: {
      eventId,
      email: normalizedEmail,
      token: hashedToken,
      expiresAt,
    },
  });

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${APP_URL}/auth/verify-cohost?token=${token}`;

  await sendCoHostInviteEmail(normalizedEmail, {
    hostName: event.host.name ?? "Your host",
    eventTitle: event.title,
    eventSlug: event.slug,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    locationType: event.locationType,
    locationName: event.locationName,
    locationAddress: event.locationAddress,
    virtualUrl: event.virtualUrl,
    inviteUrl,
    theme: event.theme,
  });

  revalidatePath(`/e/${event.slug}/settings`);
  return { success: true, invitationId: invite.id, email: normalizedEmail, invited: true };
}

export async function removeCoHost(cohostId: string) {
  const cohost = await db.eventCoHost.findUnique({
    where: { id: cohostId },
    select: { userId: true, eventId: true, event: { select: { slug: true } } },
  });
  if (!cohost) throw new Error("Forbidden");

  const session = await getSession();
  const isRemovingSelf = session && session.userId === cohost.userId;
  if (!isRemovingSelf) {
    await assertHost(cohost.eventId);
  }
  await db.eventCoHost.delete({ where: { id: cohostId } });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
}

export async function updateCoHostDisplayName(cohostId: string, displayName: string | null) {
  const cohost = await db.eventCoHost.findUnique({
    where: { id: cohostId },
    select: { userId: true, eventId: true, event: { select: { slug: true } } },
  });
  if (!cohost) throw new Error("Forbidden");

  const session = await getSession();
  const isSelf = session && session.userId === cohost.userId;
  if (!isSelf) {
    await assertHost(cohost.eventId);
  }
  await db.eventCoHost.update({
    where: { id: cohostId },
    data: { displayName: displayName ? displayName.trim() : null },
  });
  revalidatePath(`/e/${cohost.event.slug}/settings`);
  return { success: true };
}

export async function cancelCoHostInvitation(invitationId: string) {
  const invite = await db.coHostInvitation.findUnique({
    where: { id: invitationId },
    include: { event: { select: { slug: true } } },
  });
  if (!invite) throw new Error("Forbidden");
  await assertHost(invite.eventId);
  await db.coHostInvitation.delete({ where: { id: invitationId } });
  revalidatePath(`/e/${invite.event.slug}/settings`);
  return { success: true };
}

export async function getPendingCoHostInvitations(eventId: string) {
  await assertHostOrCohost(eventId);
  const invites = await db.coHostInvitation.findMany({
    where: { eventId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  });
  return invites;
}

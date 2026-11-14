"use server";

import { eventActionMessage } from "./localization";

import { revalidatePath } from "next/cache";
import { PotluckItemSchema, PotluckClaimSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { assertHostOrCohost, findApprovedGuestByToken } from "./shared";
import { assertCaptcha } from "@/lib/captcha";

// ── Potluck ───────────────────────────────────────────────────────────────────

export async function addPotluckItem(
  eventId: string,
  label: string,
  quantity: number = 1,
  captchaToken?: string | null
) {
  ({ label, quantity } = PotluckItemSchema.parse({ label, quantity }));
  const event = await assertHostOrCohost(eventId);
  await assertCaptcha("potluck_manage", captchaToken);
  const item = await db.potluckItem.create({ data: { eventId, label, quantity } });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: item.id };
}

export async function removePotluckItem(itemId: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!item) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(item.eventId);
  await db.potluckItem.delete({ where: { id: itemId } });
  revalidatePath(`/e/${item.event.slug}`);
}

export async function claimPotluckItem(
  itemId: string,
  guestName: string,
  claimedQty: number = 1,
  guestEditToken?: string
) {
  ({ guestName, claimedQty } = PotluckClaimSchema.parse({ guestName, claimedQty }));
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    include: {
      claims: true,
      event: { select: { slug: true, hostId: true, coHosts: { select: { userId: true } } } },
    },
  });
  if (!item) return { success: false, error: await eventActionMessage("itemNotFound") };

  // SEC-4 / SEC-24: host/cohost session, OR an approved RSVP proven by its
  // secret editToken. The claimant name is taken from that RSVP, never the
  // client, so a caller can't claim under someone else's identity.
  const session = await getSession();
  const isHost = item.event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = item.event.coHosts.some((ch) => ch.userId === session?.userId);
  let rsvpId: string | null = null;
  if (!isHost && !isCohost) {
    const rsvp = await findApprovedGuestByToken(guestEditToken, item.eventId);
    if (!rsvp) {
      return { success: false, error: await eventActionMessage("claimRsvpRequired") };
    }
    guestName = rsvp.guestName;
    rsvpId = rsvp.id;
  }

  const { claim, remaining } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "PotluckItem" WHERE id = ${itemId} FOR UPDATE`;
    const current = await tx.potluckItem.findUnique({
      where: { id: itemId },
      include: { claims: true },
    });
    if (!current) return { claim: null, remaining: 0 };
    const remaining =
      current.quantity - current.claims.reduce((sum, entry) => sum + entry.quantity, 0);
    if (claimedQty > remaining) return { claim: null, remaining };
    const claim = await tx.potluckClaim.create({
      data: {
        potluckItemId: itemId,
        guestName,
        quantity: claimedQty,
        rsvpId,
        userId: rsvpId ? null : session!.userId,
      },
    });
    return { claim, remaining };
  });
  if (!claim)
    return { success: false, error: await eventActionMessage("itemsRemaining", { remaining }) };

  const qtyStr = claimedQty > 1 ? ` (x${claimedQty})` : "";
  const activityEvent = await logActivity(
    item.eventId,
    "potluck_claim",
    `${guestName} is bringing${qtyStr}: ${item.label}`,
    guestName
  ).catch(logSafe("claimPotluckItem"));
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent, claim };
}

export async function unclaimPotluckItem(itemId: string, claimId: string, guestEditToken?: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    include: {
      claims: true,
      event: { select: { hostId: true, slug: true, coHosts: { select: { userId: true } } } },
    },
  });
  if (!item) return { success: false, error: await eventActionMessage("itemNotFound") };

  const session = await getSession();
  const isHost = item.event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = item.event.coHosts.some(
    (ch: { userId: string }) => ch.userId === session?.userId
  );

  const claim = item.claims.find((entry) => entry.id === claimId);
  if (!claim) return { success: false, error: await eventActionMessage("claimNotFound") };
  if (!isHost && !isCohost) {
    const rsvp = await findApprovedGuestByToken(guestEditToken, item.eventId);
    if (!rsvp || claim.rsvpId !== rsvp.id) {
      return { success: false, error: await eventActionMessage("unclaimRsvpRequired") };
    }
  }
  const guestName = claim.guestName;

  await db.potluckClaim.delete({
    where: { id: claim.id },
  });

  const activityEvent = await logActivity(
    item.eventId,
    "potluck_unclaim",
    `${guestName} won't bring: ${item.label}`,
    guestName
  ).catch(logSafe("unclaimPotluckItem"));
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent };
}

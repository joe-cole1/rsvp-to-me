"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { assertHostOrCohost, findApprovedGuestByToken } from "./shared";

// ── Potluck ───────────────────────────────────────────────────────────────────

export async function addPotluckItem(eventId: string, label: string, quantity: number = 1) {
  const event = await assertHostOrCohost(eventId);
  const item = await db.potluckItem.create({ data: { eventId, label, quantity } });
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: item.id };
}

export async function removePotluckItem(itemId: string) {
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!item) throw new Error("Forbidden");
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
  const item = await db.potluckItem.findUnique({
    where: { id: itemId },
    include: {
      claims: true,
      event: { select: { slug: true, hostId: true, coHosts: { select: { userId: true } } } },
    },
  });
  if (!item) return { success: false, error: "Item not found" };

  // SEC-4 / SEC-24: host/cohost session, OR an approved RSVP proven by its
  // secret editToken. The claimant name is taken from that RSVP, never the
  // client, so a caller can't claim under someone else's identity.
  const session = await getSession();
  const isHost = item.event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = item.event.coHosts.some((ch) => ch.userId === session?.userId);
  if (!isHost && !isCohost) {
    const rsvp = await findApprovedGuestByToken(guestEditToken, item.eventId);
    if (!rsvp) {
      return { success: false, error: "A valid approved RSVP is required to claim items." };
    }
    guestName = rsvp.guestName;
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
  ).catch(logSafe("claimPotluckItem"));
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent, claim };
}

export async function unclaimPotluckItem(
  itemId: string,
  guestName: string,
  guestEditToken?: string
) {
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

  // SEC-4 / SEC-24: hosts/cohosts/admins may unclaim freely (and pass the target
  // claimant's name). A guest must prove an approved RSVP by its secret
  // editToken; the name is then taken from that RSVP, never the client.
  if (!isHost && !isCohost) {
    const rsvp = await findApprovedGuestByToken(guestEditToken, item.eventId);
    if (!rsvp) {
      return { success: false, error: "A valid approved RSVP is required to unclaim items." };
    }
    guestName = rsvp.guestName;
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
  ).catch(logSafe("unclaimPotluckItem"));
  revalidatePath(`/e/${item.event.slug}`);
  return { success: true, activityEvent };
}

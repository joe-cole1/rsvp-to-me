"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { getChannelConfig } from "@/lib/config";
import { normalizePhone } from "@/lib/auth";
import { AddWalkInSchema } from "@/lib/schemas";
import { assertHostOrCohost } from "./shared";

type EligibleRsvp = {
  id: string;
  eventId: string;
  guestName: string;
  approved: boolean;
  status: "GOING" | "MAYBE" | "NO" | "INVITED";
  event: { slug: string };
};

async function getAuthorizedRsvp(rsvpId: string): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  rsvp: EligibleRsvp;
}> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const rsvp = await db.rSVP.findUnique({
    where: { id: rsvpId },
    select: {
      id: true,
      eventId: true,
      guestName: true,
      approved: true,
      status: true,
      event: { select: { slug: true } },
    },
  });
  if (!rsvp) throw new Error("Forbidden");
  await assertHostOrCohost(rsvp.eventId);
  return { session, rsvp };
}

function isEligible(rsvp: Pick<EligibleRsvp, "approved" | "status">): boolean {
  return rsvp.approved && (rsvp.status === "GOING" || rsvp.status === "MAYBE");
}

function isUniqueConflict(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "P2002";
}

export async function checkInRsvp(rsvpId: string) {
  const { session, rsvp } = await getAuthorizedRsvp(rsvpId);
  if (!isEligible(rsvp)) {
    return {
      success: false as const,
      error: "Only approved Going or Maybe RSVPs can be checked in.",
    };
  }

  const existing = await db.checkIn.findUnique({ where: { rsvpId } });
  if (existing) return { success: true as const, checkIn: existing, alreadyCheckedIn: true };

  let checkIn;
  try {
    checkIn = await db.checkIn.create({
      data: {
        eventId: rsvp.eventId,
        rsvpId,
        checkedInBy: session.email,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    checkIn = await db.checkIn.findUnique({ where: { rsvpId } });
    if (!checkIn) throw error;
    return { success: true as const, checkIn, alreadyCheckedIn: true };
  }

  logActivity(rsvp.eventId, "check_in", `checked in ${rsvp.guestName}`, session.email).catch(
    logSafe("checkInRsvp")
  );
  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true as const, checkIn, alreadyCheckedIn: false };
}

export async function undoCheckIn(rsvpId: string) {
  const { session, rsvp } = await getAuthorizedRsvp(rsvpId);
  const deleted = await db.checkIn.deleteMany({ where: { rsvpId, eventId: rsvp.eventId } });

  if (deleted.count > 0) {
    logActivity(
      rsvp.eventId,
      "check_in_undo",
      `undid check-in for ${rsvp.guestName}`,
      session.email
    ).catch(logSafe("undoCheckIn"));
  }
  revalidatePath(`/e/${rsvp.event.slug}/guests`);
  revalidatePath(`/e/${rsvp.event.slug}`);
  return { success: true as const, wasCheckedIn: deleted.count > 0 };
}

export async function addWalkIn(rawInput: unknown) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const parsed = AddWalkInSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: "Please check the walk-in details and try again." };
  }
  const data = parsed.data;
  const event = await assertHostOrCohost(data.eventId);
  const channels = await getChannelConfig();

  if (data.guestEmail && !channels.email) {
    return { success: false as const, error: "Email is not enabled for this site." };
  }
  if (data.guestPhone && !channels.sms) {
    return { success: false as const, error: "SMS is not enabled for this site." };
  }

  const guestEmail = data.guestEmail || null;
  const guestPhone = data.guestPhone ? normalizePhone(data.guestPhone) : null;
  const contactFilters = [
    ...(guestEmail ? [{ guestEmail: { equals: guestEmail, mode: "insensitive" as const } }] : []),
    ...(guestPhone ? [{ guestPhone }] : []),
  ];
  if (contactFilters.length > 0) {
    const matches = await db.rSVP.findMany({
      where: { eventId: data.eventId, OR: contactFilters },
      select: { id: true, guestName: true, status: true, approved: true },
      take: 2,
    });
    if (matches.length > 1) {
      return {
        success: false as const,
        error:
          "That contact information matches more than one RSVP. Search the guest list instead.",
      };
    }
    if (matches[0]) {
      return {
        success: true as const,
        kind: "existing" as const,
        rsvpId: matches[0].id,
        guestName: matches[0].guestName,
        status: matches[0].status,
        approved: matches[0].approved,
      };
    }
  }

  let userId: string | undefined;
  if (guestEmail) {
    const user = await db.user.upsert({
      where: { email: guestEmail },
      create: { email: guestEmail, name: data.guestName },
      update: {},
      select: { id: true },
    });
    userId = user.id;
  } else if (guestPhone) {
    const user = await db.user.upsert({
      where: { phone: guestPhone },
      create: { phone: guestPhone, name: data.guestName },
      update: {},
      select: { id: true },
    });
    userId = user.id;
  }

  const created = await db.$transaction(async (tx) => {
    const rsvp = await tx.rSVP.create({
      data: {
        eventId: data.eventId,
        guestName: data.guestName,
        guestEmail,
        guestPhone,
        status: "GOING",
        responded: true,
        approved: true,
        plusOneCount: data.totalPartySize - 1,
        userId,
      },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        status: true,
        plusOneCount: true,
        approved: true,
        note: true,
        createdAt: true,
        editToken: true,
      },
    });
    const checkIn = await tx.checkIn.create({
      data: {
        eventId: data.eventId,
        rsvpId: rsvp.id,
        checkedInBy: session.email,
      },
    });
    return { rsvp, checkIn };
  });

  logActivity(
    data.eventId,
    "walk_in",
    `added and checked in ${data.guestName}`,
    session.email
  ).catch(logSafe("addWalkIn"));
  revalidatePath(`/e/${event.slug}/guests`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true as const, kind: "created" as const, ...created };
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { AddCommentSchema } from "@/lib/schemas";
import { findApprovedGuestByToken } from "./shared";

// ── Comments ──────────────────────────────────────────────────────────────────
export async function addComment(rawInput: unknown) {
  const data = AddCommentSchema.parse(rawInput);

  // Load the event once — reused for the comments-enabled gate and the SEC-17
  // host/co-host relationship check below.
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: {
      slug: true,
      commentsEnabled: true,
      hostId: true,
      visibility: true,
      coHosts: { select: { userId: true } },
    },
  });
  if (!event?.commentsEnabled) return { success: false, error: "Comments disabled" };

  // SEC-17: authorize the author and derive the stored display name server-side.
  // Mirrors the castVote / claimPotluckItem authorization shape — host/co-host/
  // admin may comment freely; everyone else must present an approved RSVP for
  // this event. The name is never taken from the client: it comes from the user
  // record or the matched RSVP row, so a caller can't post under another
  // person's identity. It also closes the PRIVATE-event bypass: a logged-in
  // user with no host/guest relationship is rejected for PRIVATE events here
  // (rather than relying on the page.tsx visibility gate), while PUBLIC/UNLISTED
  // events — viewable by anyone — accept any logged-in user's verified name.
  const session = await getSession();
  const isHost = event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);

  let guestName: string;
  let rsvpId: string | null = null;

  if (session && (isHost || isCohost)) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    guestName = user?.name?.trim() || user?.email || "Host";
  } else if (session) {
    // Authenticated non-host. Look up any RSVP linked to their account.
    const rsvp = await db.rSVP.findFirst({
      where: { eventId: data.eventId, userId: session.userId },
      select: { id: true, guestName: true, approved: true },
    });
    if (rsvp) {
      // A guest with an RSVP comments under their RSVP name, but only once the
      // host has approved it — a pending RSVP can view but not comment.
      if (!rsvp.approved) {
        return { success: false, error: "You must be an approved guest to comment." };
      }
      guestName = rsvp.guestName;
      rsvpId = rsvp.id;
    } else if (event.visibility === "PRIVATE") {
      // No RSVP and no host/co-host relationship to a PRIVATE event — this is
      // the SEC-17 case: a logged-in user must not comment on an event they
      // have no access to.
      return { success: false, error: "You must be an approved guest to comment." };
    } else {
      // PUBLIC / UNLISTED events are viewable by anyone, so a logged-in user
      // with no RSVP may comment under their own verified identity (name taken
      // from the user record, never the client).
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      });
      guestName = user?.name?.trim() || user?.email || "Guest";
    }
  } else {
    // Unauthenticated guest (SEC-3 / SEC-24): authorize with the secret
    // per-RSVP editToken, not the public rsvpId. The stored display name is
    // taken from the matched approved RSVP row, never the client `guestName`.
    const rsvp = await findApprovedGuestByToken(data.guestEditToken, data.eventId);
    if (!rsvp) {
      return { success: false, error: "A valid approved RSVP is required to comment." };
    }
    guestName = rsvp.guestName;
    rsvpId = rsvp.id;
  }

  // SEC-13: when replying, verify the parent comment belongs to THIS event so a
  // reply can't be threaded under a comment from a different event.
  let parentId: string | null = null;
  if (data.parentId) {
    const parent = await db.comment.findFirst({
      where: { id: data.parentId, eventId: data.eventId },
      select: { id: true },
    });
    if (!parent) {
      return { success: false, error: "Invalid parent comment." };
    }
    parentId = parent.id;
  }

  const comment = await db.comment.create({
    data: {
      eventId: data.eventId,
      guestName,
      body: data.body,
      rsvpId,
      parentId,
    },
  });

  // Log comment activity
  const bodyPreview = data.body.slice(0, 30) + (data.body.length > 30 ? "..." : "");
  await logActivity(
    data.eventId,
    "comment_new",
    `${guestName} commented: "${bodyPreview}"`,
    guestName
  ).catch(logSafe("addComment"));

  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: comment.id };
}

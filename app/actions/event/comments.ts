"use server";

import { eventActionMessage } from "./localization";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { resolveEventAccess } from "@/lib/eventAccess";
import { AddCommentSchema, PollVoterNameSchema } from "@/lib/schemas";
import { findApprovedGuestByToken } from "./shared";
import { assertCaptcha } from "@/lib/captcha";
import { assertHostOrCohost } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { getOrCreatePollVoterTokenHash } from "@/lib/poll-voter-token";

// A single statement removes the selected comment and all of its replies.
// Authorization is event-scoped; a supplied id from another event changes nothing.
export async function deleteComment(eventId: string, commentId: string) {
  const event = await assertHostOrCohost(eventId);
  const removed = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE thread AS (
      SELECT id FROM "Comment" WHERE id = ${commentId} AND "eventId" = ${eventId}
      UNION
      SELECT c.id FROM "Comment" c JOIN thread t ON c."parentId" = t.id
      WHERE c."eventId" = ${eventId}
    )
    DELETE FROM "Comment" WHERE id IN (SELECT id FROM thread)
    RETURNING id
  `;
  revalidatePath(`/e/${event.slug}`);
  revalidatePath("/");
  return { success: true as const, removedIds: removed.map((row) => row.id) };
}

// ── Comments ──────────────────────────────────────────────────────────────────
export async function addComment(rawInput: unknown, captchaToken?: string | null) {
  const data = AddCommentSchema.parse(rawInput);
  await assertCaptcha("comment", captchaToken);

  // Load the event once — reused for the comments-enabled gate and the SEC-17
  // host/co-host relationship check below.
  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      status: true,
      passwordHash: true,
      slug: true,
      rsvpEnabled: true,
      commentsEnabled: true,
      hostId: true,
      visibility: true,
      coHosts: { select: { userId: true } },
    },
  });
  if (!event?.commentsEnabled)
    return { success: false, error: await eventActionMessage("commentsDisabled") };

  if (
    event.status !== "PUBLISHED" ||
    (await resolveEventAccess(event, event.slug, { token: data.guestEditToken ?? undefined }))
      .decision !== "granted"
  ) {
    return { success: false, error: await eventActionMessage("forbidden") };
  }

  // SEC-17: authorize the author and derive the stored display name server-side.
  // Mirrors the castVote / claimPotluckItem authorization shape — host/co-host/
  // admin may comment freely; on RSVP events everyone else must present an
  // approved RSVP (or verified account on PUBLIC/UNLISTED). On info-only events
  // (`rsvpEnabled === false`), anyone who passes `resolveEventAccess` (including
  // password-unlocked PRIVATE events) may comment with CAPTCHA + rate limit.
  const session = await getSession();
  const isHost = event.hostId === session?.userId || session?.role === "ADMIN";
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);

  let guestName: string;
  let rsvpId: string | null = null;
  let voterTokenHash: string | null = null;

  if (session && (isHost || isCohost)) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    guestName = user?.name?.trim() || user?.email || "Host";
  } else if (event.rsvpEnabled === false) {
    const rlKey = isTrustedIpConfigured()
      ? `comment:${event.id}:${await getClientIp()}`
      : `comment:${event.id}:shared`;
    const rl = await rateLimit(rlKey, isTrustedIpConfigured() ? 20 : 80, 600);
    if (!rl.success) {
      return { success: false, error: await eventActionMessage("commentRateLimited") };
    }
    if (session) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      });
      guestName = user?.name?.trim() || user?.email || "Guest";
    } else {
      const parsedName = PollVoterNameSchema.safeParse(data.guestName);
      if (!parsedName.success) {
        return { success: false, error: await eventActionMessage("commentNameRequired") };
      }
      guestName = parsedName.data;
      voterTokenHash = await getOrCreatePollVoterTokenHash();
    }
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
        return { success: false, error: await eventActionMessage("commentApprovalRequired") };
      }
      guestName = rsvp.guestName;
      rsvpId = rsvp.id;
    } else if (event.visibility === "PRIVATE") {
      // No RSVP and no host/co-host relationship to a PRIVATE event — this is
      // the SEC-17 case: a logged-in user must not comment on an event they
      // have no access to.
      return { success: false, error: await eventActionMessage("commentApprovalRequired") };
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
      return { success: false, error: await eventActionMessage("commentRsvpRequired") };
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
      return { success: false, error: await eventActionMessage("invalidParentComment") };
    }
    parentId = parent.id;
  }

  const comment = await db.comment.create({
    data: {
      eventId: data.eventId,
      guestName,
      body: data.body,
      rsvpId,
      voterTokenHash,
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

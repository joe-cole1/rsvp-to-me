import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/session-user";
import { getUnlockSignature } from "@/lib/crypto";

/**
 * Minimal event shape required to evaluate the visibility/password gate.
 * Callers must select these fields (all scalars come back by default from
 * `findUnique`; `coHosts` must be explicitly included/selected).
 */
export type GateEvent = {
  id: string;
  visibility: string;
  passwordHash: string | null;
  hostId: string;
  coHosts: { userId: string }[];
};

/**
 * The logged-in user's own RSVP, when they are a plain guest (not a host).
 * Shape mirrors what the event page needs downstream for guest display.
 */
export type LoggedInUserRsvp = {
  id: string;
  guestName: string;
  editToken: string;
  status: string;
  responded: boolean;
  approved: boolean;
  _count: { answers: number };
};

export type EventAccessDecision = "granted" | "password" | "private-blocked";

export type EventAccess = {
  sessionUser: SessionUser | null;
  isHost: boolean;
  isUnlocked: boolean;
  hasValidToken: boolean;
  isLoggedInGuest: boolean;
  loggedInUserRsvp: LoggedInUserRsvp | null;
  decision: EventAccessDecision;
};

export type ResolveEventAccessOptions = {
  /** RSVP editToken from the URL — lets INVITED guests through the private gate. */
  token?: string;
  /** `?preview=1` — host is intentionally viewing the guest experience. */
  isPreview?: boolean;
  /** `?admin=1` — an ADMIN is moderating this event. */
  admin?: boolean;
};

/**
 * Single source of truth for the `/e/[slug]` visibility + password gate.
 *
 * Access is granted to hosts/co-hosts, moderating admins, holders of the
 * signed unlock cookie, valid-token invitees, and the logged-in guest who
 * already has an RSVP on the event. Everyone else is blocked on PRIVATE
 * events (or offered the password form) and on password-protected events.
 *
 * `decision`:
 *   - "granted"         → render/serve the resource
 *   - "password"        → offer the PasswordGate (a valid access path exists)
 *   - "private-blocked" → PRIVATE with no password path; deny outright
 */
export async function resolveEventAccess(
  event: GateEvent,
  slug: string,
  opts: ResolveEventAccessOptions = {}
): Promise<EventAccess> {
  const { token, isPreview = false, admin = false } = opts;

  const sessionUser = await getSessionUser();
  const isHostOwner = sessionUser?.id === event.hostId;
  const isCohost = event.coHosts.some((ch) => ch.userId === sessionUser?.id);
  const isAdminModerating = sessionUser?.role === "ADMIN" && admin;
  const isHost = !isPreview && (isHostOwner || isCohost || isAdminModerating);

  // Signed unlock cookie set after the guest enters the event password.
  const unlockedCookie = (await cookies()).get(`rsvp-unlocked-${slug}`)?.value;
  const isUnlocked = unlockedCookie === getUnlockSignature(slug);

  // A URL token that maps to a real RSVP lets INVITED guests through.
  const hasValidToken = token
    ? !!(await db.rSVP.findFirst({
        where: { editToken: token, eventId: event.id },
        select: { id: true },
      }))
    : false;

  // A logged-in guest with an existing RSVP on this event bypasses the gate.
  const loggedInUserRsvp =
    !isHost && !token && sessionUser?.id
      ? await db.rSVP.findFirst({
          where: { userId: sessionUser.id, eventId: event.id },
          select: {
            id: true,
            guestName: true,
            editToken: true,
            status: true,
            responded: true,
            approved: true,
            _count: { select: { answers: true } },
          },
        })
      : null;
  const isLoggedInGuest = !!loggedInUserRsvp;

  let decision: EventAccessDecision = "granted";
  if (
    event.visibility === "PRIVATE" &&
    !isHost &&
    !isUnlocked &&
    !hasValidToken &&
    !isLoggedInGuest
  ) {
    // Password is a valid access path when configured; otherwise deny outright.
    decision = event.passwordHash ? "password" : "private-blocked";
  } else if (event.passwordHash && !isHost && !isUnlocked) {
    decision = "password";
  }

  return {
    sessionUser,
    isHost,
    isUnlocked,
    hasValidToken,
    isLoggedInGuest,
    loggedInUserRsvp,
    decision,
  };
}

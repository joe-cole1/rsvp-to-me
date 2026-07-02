// Shared authorization helpers for the event action modules.
//
// Deliberately a plain module (no "use server"): Next.js 16 requires every
// export of a "use server" file to be an async server action, and these
// helpers must never be exposed as client-invocable endpoints. They are
// imported by the sibling feature modules only and are NOT re-exported from
// the ./index barrel, preserving the pre-split public API.
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ── Auth guard ─────────────────────────────────────────────────────────────────

export async function assertHost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, slug: true },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("Forbidden");
  return event;
}

export async function assertHostOrCohost(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, slug: true, coHosts: { select: { userId: true } } },
  });
  if (!event) throw new Error("Forbidden");
  const isOwner = event.hostId === session.userId;
  const isCohost = event.coHosts.some((ch: { userId: string }) => ch.userId === session.userId);
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isCohost && !isAdmin) throw new Error("Forbidden");
  return event;
}

// SEC-24: authorize an unauthenticated guest action by the secret per-RSVP
// editToken (which only the guest holds), not a public rsvpId + client-supplied
// name. Both the RSVP id and guestName are shipped to every viewer of the event
// page, so matching them proved nothing — anyone could act as any approved
// guest. Returns the approved RSVP (id + authoritative guestName) or null; the
// caller uses rsvp.guestName as the identity and never trusts a client name.
export async function findApprovedGuestByToken(
  editToken: string | undefined | null,
  eventId: string
) {
  if (!editToken) return null;
  return db.rSVP.findFirst({
    where: { editToken, eventId, approved: true },
    select: { id: true, guestName: true },
  });
}

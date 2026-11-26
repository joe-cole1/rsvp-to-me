import { db } from "./db";
import { guestCountLabel, resolveGuestRsvpDisplay } from "./guestRsvpDisplay";

export async function getUpcomingPublicEvents(now = new Date()) {
  const events = await db.event.findMany({
    where: { visibility: "PUBLIC", status: "PUBLISHED", passwordHash: null, startAt: { gt: now } },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: 20,
    include: {
      host: { select: { name: true, email: true, avatarUrl: true } },
      theme: true,
      _count: {
        select: { rsvps: { where: { status: "GOING", approved: true } }, comments: true },
      },
    },
  });
  return events.map(({ _count, ...event }) => ({
    ...event,
    goingLabel:
      event.rsvpEnabled !== false && event.guestListVis === "ALL"
        ? guestCountLabel(_count.rsvps, resolveGuestRsvpDisplay(event).GOING)
        : null,
    commentCount: event.commentsEnabled ? _count.comments : 0,
  }));
}

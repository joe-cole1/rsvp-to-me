import { db } from "./db";
import { invalidateUserSessions } from "./session";

export async function scheduleUserDeletion(userId: string) {
  const now = new Date();

  const upcomingEvents = await db.event.findMany({
    where: { hostId: userId, status: "PUBLISHED", startAt: { gt: now } },
    select: { id: true, title: true, slug: true },
  });

  if (upcomingEvents.length > 0) {
    return { blocked: true as const, events: upcomingEvents };
  }

  const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: now, deletionScheduledAt: scheduledAt },
  });

  await invalidateUserSessions(userId);

  return { success: true as const, scheduledAt };
}

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

export async function cancelUserDeletion(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: null, deletionScheduledAt: null },
  });
}

export async function performImmediateUserDeletion(userId: string): Promise<void> {
  // Delete user's guest RSVPs on other events (cascades: RSVPAnswers, PlusOneGuests, CheckIns)
  await db.rSVP.deleteMany({ where: { userId } });

  // Remove co-host slots on other events
  await db.eventCoHost.deleteMany({ where: { userId } });

  // Clean up auth tokens and sessions
  await db.magicToken.deleteMany({ where: { userId } });
  await db.session.deleteMany({ where: { userId } });

  // Reassign hosted events to the SYSTEM tombstone user
  await db.event.updateMany({ where: { hostId: userId }, data: { hostId: "system" } });

  // Anonymize PII
  await db.user.update({
    where: { id: userId },
    data: {
      email: null,
      phone: null,
      name: "Deleted User",
      avatarUrl: null,
      role: "GUEST",
      deletionRequestedAt: null,
      deletionScheduledAt: null,
    },
  });
}

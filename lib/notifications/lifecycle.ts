import { db } from "@/lib/db";

/**
 * Authentication changes retire matching notification proof, never event contacts and
 * never channel consent: the person keeps receiving at contacts their events still hold.
 */
export async function retireChangedAccountConnection(
  userId: string,
  channel: string,
  oldDestination: string | null
) {
  if (!oldDestination) return;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`profile:${userId}`}, 0))`;
    const connection = await tx.notificationConnection.findFirst({
      where: { userId, channel, destination: oldDestination, revokedAt: null },
    });
    if (!connection) return;
    await tx.notificationConnection.update({
      where: { id: connection.id },
      data: { revokedAt: new Date(), generation: { increment: 1 } },
    });
    await tx.notificationBinding.updateMany({
      where: { connectionId: connection.id },
      data: { revokedAt: new Date() },
    });
    await tx.notificationChallenge.updateMany({
      where: { userId, channel, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
}

const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Challenges hold private destinations; keep them only while they can matter. */
export async function purgeNotificationChallenges(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  const { count } = await db.notificationChallenge.deleteMany({
    where: { OR: [{ usedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
  });
  return count;
}

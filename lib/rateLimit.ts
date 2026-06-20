import { db } from "./db";

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  const now = new Date();

  // Try to find the rate limit record
  const record = await db.rateLimit.findUnique({
    where: { key },
  });

  if (!record || record.expireAt < now) {
    const expireAt = new Date(now.getTime() + windowSeconds * 1000);
    // Upsert to handle race conditions where multiple requests hit at the same time
    const updated = await db.rateLimit.upsert({
      where: { key },
      update: {
        points: 1,
        expireAt,
      },
      create: {
        key,
        points: 1,
        expireAt,
      },
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: updated.expireAt,
    };
  }

  if (record.points >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: record.expireAt,
    };
  }

  const updated = await db.rateLimit.update({
    where: { key },
    data: {
      points: { increment: 1 },
    },
  });

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - updated.points),
    reset: updated.expireAt,
  };
}

export async function cleanupRateLimits(): Promise<void> {
  const now = new Date();
  await db.rateLimit.deleteMany({
    where: { expireAt: { lt: now } },
  }).catch(() => {});
}

import { db } from "./db";
import { isRedisEnabled, redisIncrAndExpire, getRedisClient } from "./redis";
import { logSafe } from "./logger";

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  const now = new Date();

  // Try Redis rate limiting if enabled
  if (isRedisEnabled()) {
    const points = await redisIncrAndExpire(key, windowSeconds);
    if (points !== null) {
      const client = await getRedisClient();
      let ttl = windowSeconds;
      if (client) {
        try {
          const redisTtl = await client.ttl(key);
          if (redisTtl > 0) {
            ttl = redisTtl;
          }
        } catch {}
      }

      const reset = new Date(Date.now() + ttl * 1000);
      return {
        success: points <= limit,
        limit,
        remaining: Math.max(0, limit - points),
        reset,
      };
    }
  }

  // Fallback to Database-driven rate limiting
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
  await db.rateLimit
    .deleteMany({
      where: { expireAt: { lt: now } },
    })
    .catch(logSafe("cleanupRateLimits"));
}

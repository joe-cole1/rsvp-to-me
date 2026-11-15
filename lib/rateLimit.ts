import { db } from "./db";
import { isRedisEnabled, redisIncrAndExpire, getRedisClient } from "./redis";
import { logSafe } from "./logger";

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
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

  // One statement serializes creation, expired-window reset and increments on
  // the unique key. A read followed by an upsert/update can admit concurrent
  // callers beyond the limit or reset another caller's fresh window.
  const [record] = await db.$queryRaw<{ points: number; expireAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "points", "expireAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + ${windowSeconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "points" = CASE
        WHEN "RateLimit"."expireAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "RateLimit"."points" + 1
      END,
      "expireAt" = CASE
        WHEN "RateLimit"."expireAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."expireAt"
        ELSE "RateLimit"."expireAt"
      END
    RETURNING "points", "expireAt"
  `;

  return {
    success: record.points <= limit,
    limit,
    remaining: Math.max(0, limit - record.points),
    reset: record.expireAt,
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

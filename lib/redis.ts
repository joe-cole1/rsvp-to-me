import { createClient } from "redis";

type RedisClientType = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as {
  redis?: RedisClientType;
  redisConnected?: boolean;
};

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("[redis] REDIS_URL is required");
}

if (!globalForRedis.redis) {
  console.log("[redis] Initializing Redis client...");
  globalForRedis.redis = createClient({ url: redisUrl });
  globalForRedis.redisConnected = false;

  globalForRedis.redis.on("error", (err) => {
    console.error("[redis] Redis client error:", err);
  });

  globalForRedis.redis.on("connect", () => {
    console.log("[redis] Redis client connected.");
    globalForRedis.redisConnected = true;
  });

  globalForRedis.redis.on("end", () => {
    console.log("[redis] Redis client connection closed.");
    globalForRedis.redisConnected = false;
  });

  globalForRedis.redis.connect().catch((err) => {
    console.error("[redis] Failed to connect to Redis on startup:", err);
  });
}

const redisClient: RedisClientType = globalForRedis.redis;

export function isRedisEnabled(): boolean {
  return !!redisClient && !!globalForRedis.redisConnected;
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!globalForRedis.redisConnected) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect().catch(() => {});
      }
    } catch {}
  }

  return globalForRedis.redisConnected ? redisClient : null;
}

export async function redisGet(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.error(`[redis] Error getting key ${key}:`, err);
    return null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    if (ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.error(`[redis] Error setting key ${key}:`, err);
    return false;
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.error(`[redis] Error deleting key ${key}:`, err);
    return false;
  }
}

export async function redisAcquireLock(
  lockKey: string,
  ttlSeconds: number
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    const result = await client.set(lockKey, "locked", {
      NX: true,
      EX: ttlSeconds,
    });
    return result === "OK";
  } catch (err) {
    console.error(`[redis] Error acquiring lock ${lockKey}:`, err);
    return false;
  }
}

export async function redisReleaseLock(lockKey: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.del(lockKey);
    return true;
  } catch (err) {
    console.error(`[redis] Error releasing lock ${lockKey}:`, err);
    return false;
  }
}

export async function redisIncrAndExpire(
  key: string,
  ttlSeconds: number
): Promise<number | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const results = await client.multi().incr(key).expire(key, ttlSeconds).exec();
    if (!results || results.length === 0) return null;
    return results[0] as unknown as number;
  } catch (err) {
    console.error(`[redis] Error incrementing rate limit key ${key}:`, err);
    return null;
  }
}

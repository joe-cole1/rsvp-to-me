// #847 root cause: read/upsert/update races reset or over-admit a DB window;
// Redis EXPIRE on every hit extended lockouts indefinitely. Exercise real stores.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
vi.mock("@/lib/redis", async (original) => {
  const actual = await original<typeof import("@/lib/redis")>();
  return { ...actual, isRedisEnabled: vi.fn(actual.isRedisEnabled) };
});
import { getRedisClient, isRedisEnabled, redisIncrAndExpire } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
const prefix = `issue-847:${randomUUID()}:`;
const usedKeys: string[] = [];
const key = () => {
  const value = prefix + randomUUID();
  usedKeys.push(value);
  return value;
};
beforeEach(() => vi.mocked(isRedisEnabled).mockReturnValue(false));
afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: prefix } } });
  const client = await getRedisClient();
  if (client && usedKeys.length) await client.del(usedKeys);
});

describe("#847: atomic PostgreSQL rate windows", () => {
  it.each(["new", "expired", "active"])(
    "admits exactly the remaining quota under concurrent %s-window requests",
    async (state) => {
      const bucket = key();
      if (state !== "new")
        await db.rateLimit.create({
          data: {
            key: bucket,
            points: state === "expired" ? 99 : 3,
            expireAt: new Date(Date.now() + (state === "expired" ? -60000 : 60000)),
          },
        });
      const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(bucket, 5, 60)));
      expect(results.filter((result) => result.success)).toHaveLength(state === "active" ? 2 : 5);
      expect(new Set(results.map((result) => result.reset.getTime())).size).toBe(1);
      expect(results.every((result) => result.remaining >= 0)).toBe(true);
      expect((await db.rateLimit.findUniqueOrThrow({ where: { key: bucket } })).points).toBe(
        state === "active" ? 23 : 20
      );
    }
  );
  it("does not extend a blocked DB window and starts a new window after expiry", async () => {
    const bucket = key();
    const expireAt = new Date(Date.now() + 5000);
    await db.rateLimit.create({ data: { key: bucket, points: 5, expireAt } });
    const blocked = await rateLimit(bucket, 5, 60);
    expect(blocked.success).toBe(false);
    expect(blocked.reset.getTime()).toBe(expireAt.getTime());
    await db.rateLimit.update({
      where: { key: bucket },
      data: { expireAt: new Date(Date.now() - 1) },
    });
    expect(await rateLimit(bucket, 5, 60)).toMatchObject({ success: true, remaining: 4 });
  });
});

describe("#847: fixed Redis windows", () => {
  it("increments concurrently without refreshing an existing expiry, including blocked hits", async () => {
    const bucket = key();
    const client = (await getRedisClient())!;
    expect(client).not.toBeNull();
    expect(await redisIncrAndExpire(bucket, 60)).toBe(1);
    expect(await client.ttl(bucket)).toBeGreaterThan(0);
    await client.pExpire(bucket, 5000);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => redisIncrAndExpire(bucket, 60))
    );
    expect([...results].sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 2)
    );
    expect(await client.pTTL(bucket)).toBeLessThanOrEqual(5000);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    expect((await rateLimit(bucket, 5, 60)).success).toBe(false);
    expect(await client.pTTL(bucket)).toBeLessThanOrEqual(5000);
    // Expire deterministically without a wall-clock sleep.
    await client.pExpire(bucket, 0);
    expect(await rateLimit(bucket, 5, 60)).toMatchObject({ success: true, remaining: 4 });
  });
});

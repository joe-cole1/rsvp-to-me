// #849 regression companion: verify the actual Redis compare/delete operation
// preserves a successor's lock after the original owner's lease expires.
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getRedisClient, redisAcquireLock, redisReleaseLock } from "@/lib/redis";
const keys: string[] = [];
afterEach(async () => {
  const client = await getRedisClient();
  if (client) for (const key of keys.splice(0)) await client.del(key);
});
describe("#849 Redis ownership", () => {
  it("does not release a successor after expiry", async () => {
    const client = await vi.waitFor(async () => {
      const connected = await getRedisClient();
      if (!connected) throw new Error("Integration Redis is not ready");
      return connected;
    });
    const key = `test:849:${randomUUID()}`;
    keys.push(key);
    const oldToken = await redisAcquireLock(key, 60);
    expect(oldToken).toEqual(expect.any(String));
    // Expire the lease immediately; no wall-clock sleep or replacement service.
    await client.expire(key, 0);
    const newToken = await redisAcquireLock(key, 60);
    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe(oldToken);
    expect(await redisReleaseLock(key, oldToken!)).toBe(false);
    expect(await client.get(key)).toBe(newToken);
    expect(await redisReleaseLock(key, newToken!)).toBe(true);
    expect(await client.get(key)).toBeNull();
  });
});

// #847 root cause: refreshing EXPIRE on every increment made retries prolong
// lockouts. The atomic Redis transaction must preserve an existing window.
import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const transaction = { incr: vi.fn(), expire: vi.fn(), exec: vi.fn() };
  transaction.incr.mockReturnValue(transaction);
  transaction.expire.mockReturnValue(transaction);
  transaction.exec.mockResolvedValue([2, 0]);
  return {
    transaction,
    client: { multi: vi.fn(() => transaction), on: vi.fn(), connect: vi.fn(async () => {}) },
  };
});
vi.mock("redis", () => ({ createClient: () => m.client }));
it("uses conditional expiry atomically with increment, preserving a live window", async () => {
  const globals = globalThis as typeof globalThis & { redis?: unknown; redisConnected?: boolean };
  const previous = { client: globals.redis, connected: globals.redisConnected };
  globals.redis = m.client;
  globals.redisConnected = true;
  try {
    const { redisIncrAndExpire } = await import("@/lib/redis");
    expect(await redisIncrAndExpire("issue-847", 60)).toBe(2);
    expect(m.transaction.expire).toHaveBeenCalledWith("issue-847", 60, "NX");
    expect(m.transaction.exec).toHaveBeenCalledOnce();
  } finally {
    globals.redis = previous.client;
    globals.redisConnected = previous.connected;
  }
});

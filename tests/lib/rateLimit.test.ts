import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockQueryRaw,
  mockDeleteMany,
  mockIsRedisEnabled,
  mockRedisIncrAndExpire,
  mockGetRedisClient,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockIsRedisEnabled: vi.fn().mockReturnValue(false),
  mockRedisIncrAndExpire: vi.fn(),
  mockGetRedisClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mockQueryRaw,
    rateLimit: { deleteMany: mockDeleteMany },
  },
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: mockIsRedisEnabled,
  redisIncrAndExpire: mockRedisIncrAndExpire,
  getRedisClient: mockGetRedisClient,
}));

import { rateLimit, cleanupRateLimits } from "@/lib/rateLimit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rateLimit — database path (Redis disabled)", () => {
  beforeEach(() => {
    mockIsRedisEnabled.mockReturnValue(false);
  });

  it.each([
    [1, true, 4],
    [3, true, 2],
    [5, true, 0],
    [6, false, 0],
  ])("returns the atomic DB result at %i points", async (points, success, remaining) => {
    const expireAt = new Date(Date.now() + 60000);
    mockQueryRaw.mockResolvedValue([{ points, expireAt }]);
    expect(await rateLimit("k-1", 5, 60)).toEqual({
      success,
      limit: 5,
      remaining,
      reset: expireAt,
    });
    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });
});

describe("rateLimit — Redis path (Redis enabled)", () => {
  beforeEach(() => {
    mockIsRedisEnabled.mockReturnValue(true);
  });

  it("calls redisIncrAndExpire when Redis is enabled", async () => {
    mockRedisIncrAndExpire.mockResolvedValue(2);
    const mockClient = {
      ttl: vi.fn().mockResolvedValue(45),
    };
    mockGetRedisClient.mockResolvedValue(mockClient);

    const result = await rateLimit("k-red", 5, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(3);
    expect(result.limit).toBe(5);
    expect(mockRedisIncrAndExpire).toHaveBeenCalledWith("k-red", 60);
  });

  it("returns success:false when Redis points > limit", async () => {
    mockRedisIncrAndExpire.mockResolvedValue(6);
    mockGetRedisClient.mockResolvedValue(null);

    const result = await rateLimit("k-red", 5, 60);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("falls back to DB path when redisIncrAndExpire returns null", async () => {
    mockRedisIncrAndExpire.mockResolvedValue(null);
    const expireAt = new Date(Date.now() + 60 * 1000);
    mockQueryRaw.mockResolvedValue([{ points: 1, expireAt }]);

    const result = await rateLimit("k-red", 5, 60);
    expect(result.success).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });
});

describe("cleanupRateLimits", () => {
  it("calls db.rateLimit.deleteMany with expireAt < now", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });
    await cleanupRateLimits();
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { expireAt: { lt: expect.any(Date) } },
    });
  });

  it("does not throw when deleteMany fails (silently caught)", async () => {
    mockDeleteMany.mockRejectedValue(new Error("DB error"));
    await expect(cleanupRateLimits()).resolves.not.toThrow();
  });
});

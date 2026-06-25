import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindUnique,
  mockUpsert,
  mockUpdate,
  mockDeleteMany,
  mockIsRedisEnabled,
  mockRedisIncrAndExpire,
  mockGetRedisClient,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockIsRedisEnabled: vi.fn().mockReturnValue(false),
  mockRedisIncrAndExpire: vi.fn(),
  mockGetRedisClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rateLimit: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      update: mockUpdate,
      deleteMany: mockDeleteMany,
    },
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

  it("creates a new record when no record exists, returns success:true with remaining=limit-1", async () => {
    mockFindUnique.mockResolvedValue(null);
    const expireAt = new Date(Date.now() + 60 * 1000);
    mockUpsert.mockResolvedValue({ key: "k-1", points: 1, expireAt });

    const result = await rateLimit("k-1", 5, 60);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(4);
    expect(result.reset).toBe(expireAt);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: "k-1" },
      update: { points: 1, expireAt: expect.any(Date) },
      create: { key: "k-1", points: 1, expireAt: expect.any(Date) },
    });
  });

  it("creates a new record when existing record is expired, returns success:true", async () => {
    // expired
    mockFindUnique.mockResolvedValue({
      key: "k-1",
      points: 5,
      expireAt: new Date(Date.now() - 1000),
    });
    const newExpireAt = new Date(Date.now() + 60 * 1000);
    mockUpsert.mockResolvedValue({ key: "k-1", points: 1, expireAt: newExpireAt });

    const result = await rateLimit("k-1", 5, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.reset).toBe(newExpireAt);
  });

  it("increments points when record exists and is below limit, returns success:true", async () => {
    const expireAt = new Date(Date.now() + 30 * 1000);
    mockFindUnique.mockResolvedValue({ key: "k-1", points: 2, expireAt });
    mockUpdate.mockResolvedValue({ key: "k-1", points: 3, expireAt });

    const result = await rateLimit("k-1", 5, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.reset).toBe(expireAt);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { key: "k-1" },
      data: { points: { increment: 1 } },
    });
  });

  it("returns success:false, remaining:0 when record is at or above limit", async () => {
    const expireAt = new Date(Date.now() + 30 * 1000);
    mockFindUnique.mockResolvedValue({ key: "k-1", points: 5, expireAt });

    const result = await rateLimit("k-1", 5, 60);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBe(expireAt);
    expect(mockUpdate).not.toHaveBeenCalled();
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
    mockFindUnique.mockResolvedValue(null);
    const expireAt = new Date(Date.now() + 60 * 1000);
    mockUpsert.mockResolvedValue({ key: "k-red", points: 1, expireAt });

    const result = await rateLimit("k-red", 5, 60);
    expect(result.success).toBe(true);
    expect(mockFindUnique).toHaveBeenCalled();
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

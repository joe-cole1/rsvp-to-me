import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSealData: vi.fn().mockResolvedValue("sealed-value"),
  mockUnsealData: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockCookiesSet: vi.fn(),
  mockCookiesDelete: vi.fn(),
  mockSessionCreate: vi.fn(),
  mockSessionFindUnique: vi.fn(),
  mockSessionDelete: vi.fn(),
  mockSessionFindMany: vi.fn(),
  mockUserCount: vi.fn().mockResolvedValue(0),
  mockUserUpdate: vi.fn(),
  mockIsRedisEnabled: vi.fn().mockReturnValue(false),
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}));

vi.mock("iron-session", () => ({
  sealData: mocks.mockSealData,
  unsealData: mocks.mockUnsealData,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mocks.mockCookiesGet,
    set: mocks.mockCookiesSet,
    delete: mocks.mockCookiesDelete,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    session: {
      create: mocks.mockSessionCreate,
      findUnique: mocks.mockSessionFindUnique,
      delete: mocks.mockSessionDelete,
      findMany: mocks.mockSessionFindMany,
    },
    user: {
      count: mocks.mockUserCount,
      update: mocks.mockUserUpdate,
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: mocks.mockIsRedisEnabled,
  redisGet: mocks.mockRedisGet,
  redisSet: mocks.mockRedisSet,
  redisDel: mocks.mockRedisDel,
}));

import {
  createSession,
  getSession,
  destroySession,
  invalidateUserSessions,
  sealSession,
} from "@/lib/session";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

describe("createSession", () => {
  it("calls db.session.create with correct userId and 7-day expiry", async () => {
    mocks.mockSessionCreate.mockResolvedValue({});
    mocks.mockSealData.mockResolvedValue("sealed-cookie-value");

    await createSession({ userId: "user-1", email: "user@example.com", role: "HOST" });
    expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        token: expect.any(String),
        userId: "user-1",
        expiresAt: expect.any(Date),
      },
    });
    expect(mocks.mockCookiesSet).toHaveBeenCalledWith(
      "rsvp-session",
      "sealed-cookie-value",
      expect.any(Object)
    );
  });
});

describe("getSession", () => {
  it("returns null when no cookie is present", async () => {
    mocks.mockCookiesGet.mockReturnValue(undefined);
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("returns null when DB session is not found", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionFindUnique.mockResolvedValue(null);

    const result = await getSession();
    expect(result).toBeNull();
  });

  it("returns SessionData when DB session is valid", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 600),
      user: { role: "HOST" },
    });

    const result = await getSession();
    expect(result).toEqual({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
  });

  it("syncs database role changes with the active session", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 600),
      user: { role: "ADMIN" },
    });

    const result = await getSession();
    expect(result?.role).toBe("ADMIN");
  });

  it("promotes initial admin email user to ADMIN in getSession", async () => {
    process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "admin@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 600),
      user: { role: "HOST" },
    });
    mocks.mockUserCount.mockResolvedValue(0);
    mocks.mockUserUpdate.mockResolvedValue({ id: "user-1", role: "ADMIN" });

    const result = await getSession();
    expect(result?.role).toBe("ADMIN");
    expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" },
    });
    delete process.env.INITIAL_ADMIN_EMAIL;
  });

  it("returns session data from Redis cache on hit", async () => {
    mocks.mockIsRedisEnabled.mockReturnValue(true);
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    const cachedData = {
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 600).toISOString(),
      userRole: "HOST",
    };
    mocks.mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

    const result = await getSession();
    expect(result).toBeDefined();
    expect(mocks.mockSessionFindUnique).not.toHaveBeenCalled();
    mocks.mockIsRedisEnabled.mockReturnValue(false);
  });

  it("reads from DB and caches in Redis on cache miss", async () => {
    mocks.mockIsRedisEnabled.mockReturnValue(true);
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockRedisGet.mockResolvedValue(null);
    mocks.mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 600),
      user: { role: "HOST" },
    });
    mocks.mockRedisSet.mockResolvedValue(true);

    const result = await getSession();
    expect(result).toBeDefined();
    expect(mocks.mockRedisSet).toHaveBeenCalled();
    mocks.mockIsRedisEnabled.mockReturnValue(false);
  });

  it("returns null when cookie contains invalid data (unsealData throws)", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockRejectedValue(new Error("unseal error"));
    const result = await getSession();
    expect(result).toBeNull();
  });
});

describe("sealSession", () => {
  it("throws error when SESSION_SECRET is too short", async () => {
    process.env.SESSION_SECRET = "short";
    await expect(
      createSession({ userId: "user-1", email: "user@example.com", role: "HOST" })
    ).rejects.toThrow("SESSION_SECRET must be at least 32 characters");
  });

  it("seals session successfully", async () => {
    mocks.mockSealData.mockResolvedValue("sealed-cookie");
    const res = await sealSession({ userId: "user-1", email: "user@example.com", role: "HOST" });
    expect(res).toBe("sealed-cookie");
  });

  it("throws error on startup/import if weak HOST_INVITE_CODE in production", async () => {
    vi.resetModules();
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    process.env.OPEN_REGISTRATION = "false";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.HOST_INVITE_CODE = "letmein"; // weak

    await expect(import("@/lib/session")).rejects.toThrow(
      "HOST_INVITE_CODE must be set to a strong random value"
    );
    (process.env as { NODE_ENV: string }).NODE_ENV = "test";
  });

  it("skips invite code validation during next build phase", async () => {
    vi.resetModules();
    process.env.NEXT_PHASE = "phase-production-build";
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    process.env.OPEN_REGISTRATION = "false";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.HOST_INVITE_CODE = "letmein"; // weak, but skips

    const sessionModule = await import("@/lib/session");
    expect(sessionModule).toBeDefined();

    delete process.env.NEXT_PHASE;
    (process.env as { NODE_ENV: string }).NODE_ENV = "test";
  });
});

describe("destroySession", () => {
  it("deletes the DB session record by sessionId from the cookie", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionDelete.mockResolvedValue({});

    await destroySession();
    expect(mocks.mockSessionDelete).toHaveBeenCalledWith({
      where: { id: "sess-1" },
    });
    expect(mocks.mockCookiesDelete).toHaveBeenCalledWith("rsvp-session");
  });

  it("deletes Redis cache session in destroySession if Redis is enabled", async () => {
    mocks.mockIsRedisEnabled.mockReturnValue(true);
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed-value" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
      sessionId: "sess-1",
    });
    mocks.mockSessionDelete.mockResolvedValue({});
    mocks.mockRedisDel.mockResolvedValue(true);

    await destroySession();
    expect(mocks.mockRedisDel).toHaveBeenCalledWith("session:sess-1");
    mocks.mockIsRedisEnabled.mockReturnValue(false);
  });
});

describe("invalidateUserSessions", () => {
  it("deletes Redis cache for each session when Redis is enabled", async () => {
    mocks.mockIsRedisEnabled.mockReturnValue(true);
    mocks.mockSessionFindMany.mockResolvedValue([{ id: "sess-1" }, { id: "sess-2" }]);
    mocks.mockRedisDel.mockResolvedValue("OK");

    await invalidateUserSessions("user-1");
    expect(mocks.mockSessionFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
    expect(mocks.mockRedisDel).toHaveBeenCalledTimes(2);
    mocks.mockIsRedisEnabled.mockReturnValue(false);
  });

  it("handles errors silently in invalidateUserSessions", async () => {
    mocks.mockSessionFindMany.mockRejectedValue(new Error("DB findMany error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await invalidateUserSessions("user-1");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

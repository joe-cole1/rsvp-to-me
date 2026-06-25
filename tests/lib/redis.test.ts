import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockExec = vi.fn();

const mockMulti = vi.fn().mockReturnValue({
  incr: mockIncr,
  expire: mockExpire,
  exec: mockExec,
});

const clientMock = {
  on: mockOn,
  connect: mockConnect,
  get: mockGet,
  set: mockSet,
  del: mockDel,
  multi: mockMulti,
  isOpen: false,
};

vi.mock("redis", () => {
  return {
    createClient: vi.fn(() => clientMock),
  };
});

type GlobalWithRedis = typeof globalThis & {
  redis?: typeof clientMock | null;
  redisConnected?: boolean | null;
};

const g = globalThis as unknown as GlobalWithRedis;

let redisModule: typeof import("@/lib/redis");
const listeners: Record<string, (arg?: unknown) => void> = {};

beforeEach(async () => {
  vi.resetModules();
  process.env.REDIS_URL = "redis://localhost:6379";
  delete g.redis;
  delete g.redisConnected;

  mockOn.mockImplementation((event, cb) => {
    listeners[event] = cb;
  });

  redisModule = await import("@/lib/redis");

  vi.clearAllMocks();
  mockIncr.mockReturnThis();
  mockExpire.mockReturnThis();
  clientMock.isOpen = false;

  g.redis = clientMock;
  g.redisConnected = true;
});

describe("lib/redis.ts", () => {
  it("isRedisEnabled returns true when connected, false otherwise", () => {
    g.redisConnected = true;
    expect(redisModule.isRedisEnabled()).toBe(true);

    g.redisConnected = false;
    expect(redisModule.isRedisEnabled()).toBe(false);
  });

  it("getRedisClient connects if not connected", async () => {
    clientMock.isOpen = false;
    g.redisConnected = false;

    mockConnect.mockResolvedValue(undefined);
    await redisModule.getRedisClient();
    expect(mockConnect).toHaveBeenCalled();

    g.redisConnected = true;
    const client = await redisModule.getRedisClient();
    expect(client).toBe(clientMock);
  });

  it("redisGet returns value from client", async () => {
    g.redisConnected = true;
    mockGet.mockResolvedValue("cached-val");
    const res = await redisModule.redisGet("my-key");
    expect(res).toBe("cached-val");
    expect(mockGet).toHaveBeenCalledWith("my-key");
  });

  it("redisGet returns null on error", async () => {
    g.redisConnected = true;
    mockGet.mockRejectedValue(new Error("Redis error"));
    const res = await redisModule.redisGet("my-key");
    expect(res).toBeNull();
  });

  it("redisSet sets value without TTL", async () => {
    g.redisConnected = true;
    mockSet.mockResolvedValue("OK");
    const res = await redisModule.redisSet("key", "val");
    expect(res).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("key", "val");
  });

  it("redisSet sets value with TTL", async () => {
    g.redisConnected = true;
    mockSet.mockResolvedValue("OK");
    const res = await redisModule.redisSet("key", "val", 60);
    expect(res).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("key", "val", { EX: 60 });
  });

  it("redisSet returns false on error", async () => {
    g.redisConnected = true;
    mockSet.mockRejectedValue(new Error("Redis error"));
    const res = await redisModule.redisSet("key", "val");
    expect(res).toBe(false);
  });

  it("redisDel deletes key", async () => {
    g.redisConnected = true;
    mockDel.mockResolvedValue(1);
    const res = await redisModule.redisDel("key");
    expect(res).toBe(true);
    expect(mockDel).toHaveBeenCalledWith("key");
  });

  it("redisDel returns false on error", async () => {
    g.redisConnected = true;
    mockDel.mockRejectedValue(new Error("Redis error"));
    const res = await redisModule.redisDel("key");
    expect(res).toBe(false);
  });

  it("redisAcquireLock returns true if client returns OK", async () => {
    g.redisConnected = true;
    mockSet.mockResolvedValue("OK");
    const res = await redisModule.redisAcquireLock("lockKey", 120);
    expect(res).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("lockKey", "locked", { NX: true, EX: 120 });
  });

  it("redisReleaseLock deletes the lockKey", async () => {
    g.redisConnected = true;
    mockDel.mockResolvedValue(1);
    const res = await redisModule.redisReleaseLock("lockKey");
    expect(res).toBe(true);
    expect(mockDel).toHaveBeenCalledWith("lockKey");
  });

  it("redisIncrAndExpire returns the incremented value", async () => {
    g.redisConnected = true;
    mockExec.mockResolvedValue([5, true]);
    const val = await redisModule.redisIncrAndExpire("rate-limit-key", 10);
    expect(val).toBe(5);
    expect(mockIncr).toHaveBeenCalledWith("rate-limit-key");
    expect(mockExpire).toHaveBeenCalledWith("rate-limit-key", 10);
    expect(mockExec).toHaveBeenCalled();
  });

  it("redisIncrAndExpire returns null on empty results or error", async () => {
    g.redisConnected = true;
    mockExec.mockResolvedValue([]);
    let val = await redisModule.redisIncrAndExpire("rate-limit-key", 10);
    expect(val).toBeNull();

    mockExec.mockRejectedValue(new Error("Redis error"));
    val = await redisModule.redisIncrAndExpire("rate-limit-key", 10);
    expect(val).toBeNull();
  });

  it("handles connection events", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Trigger error event
    listeners["error"](new Error("Test error"));
    expect(errorSpy).toHaveBeenCalled();

    // Trigger connect event
    listeners["connect"]();
    expect(g.redisConnected).toBe(true);

    // Trigger end event
    listeners["end"]();
    expect(g.redisConnected).toBe(false);

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("handles startup connect failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.resetModules();
    delete g.redis;
    delete g.redisConnected;
    mockConnect.mockRejectedValueOnce(new Error("Startup connection failed"));

    await import("@/lib/redis");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[redis] Failed to connect to Redis on startup:"),
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });

  it("handles reconnect failure silently in getRedisClient", async () => {
    clientMock.isOpen = false;
    g.redisConnected = false;
    mockConnect.mockRejectedValueOnce(new Error("Reconnect failed"));

    const client = await redisModule.getRedisClient();
    expect(client).toBeNull();
  });
});

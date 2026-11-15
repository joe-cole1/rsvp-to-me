// #849 root causes: stale lock owners deleted replacement locks; deletion logs
// retained erased contact details; instrumentation exited before Next.js drained.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  stop: vi.fn(),
  eval: vi.fn(),
  set: vi.fn(),
  deleted: vi.fn(),
  user: vi.fn(),
  locks: vi.fn(),
  callbacks: new Map<string, () => void | Promise<void>>(),
}));
vi.mock("redis", () => ({
  createClient: () => ({ on: vi.fn(), connect: async () => {}, set: m.set, eval: m.eval }),
}));
vi.mock("node-cron", () => ({
  default: {
    validate: () => true,
    schedule: (pattern: string, cb: () => void) => {
      m.callbacks.set(pattern, cb);
      return { stop: m.stop };
    },
  },
}));
vi.mock("@/lib/reminders", () => ({ processReminders: async () => {} }));
vi.mock("@/lib/backup", () => ({ runBackup: async () => {} }));
vi.mock("@/lib/rateLimit", () => ({ cleanupRateLimits: async () => {} }));
vi.mock("@/lib/notifications/lifecycle", () => ({ purgeNotificationChallenges: async () => {} }));
vi.mock("@/lib/account-deletion", () => ({ performImmediateUserDeletion: m.deleted }));
vi.mock("@/lib/db", () => ({
  db: {
    cronLock: { create: async () => {}, deleteMany: m.locks },
    user: { findMany: m.user },
    event: { count: async () => 0 },
    systemConfig: { findUnique: async () => null },
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  m.callbacks.clear();
  m.locks.mockResolvedValue({ count: 1 });
  m.user.mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  const g = globalThis as unknown as { redis?: unknown; redisConnected?: boolean };
  delete g.redis;
  delete g.redisConnected;
});
describe("#849 scheduler safety", () => {
  it("uses a distinct token and an atomic compare-delete for stale Redis owners", async () => {
    const g = globalThis as unknown as { redis?: unknown; redisConnected?: boolean };
    delete g.redis;
    delete g.redisConnected;
    const redis = await import("@/lib/redis");
    g.redisConnected = true;
    m.set.mockResolvedValue("OK");
    m.eval.mockResolvedValue(0);
    const oldToken = await redis.redisAcquireLock("job", 1);
    const newToken = await redis.redisAcquireLock("job", 1);
    expect(oldToken).not.toBe(newToken);
    await expect(redis.redisReleaseLock("job", oldToken!)).resolves.toBe(false);
    expect(m.eval).toHaveBeenCalledWith(expect.stringMatching(/get[\s\S]*ARGV\[1\][\s\S]*del/), {
      keys: ["job"],
      arguments: [oldToken],
    });
  });
  it("logs account deletion without retaining name or email", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    m.user.mockResolvedValue([
      { id: "erased-user", email: "erased@example.test", name: "Erased Person" },
    ]);
    const { startInProcessCron, stopInProcessCron } = await import("@/lib/cron-scheduler");
    await startInProcessCron();
    await vi.waitFor(() => expect(m.deleted).toHaveBeenCalledWith("erased-user"));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/erased@example|Erased Person/);
    expect(m.user).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }));
    expect(m.locks).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jobName: "process_expired_deletions",
          lockedAt: expect.any(Date),
          expireAt: expect.any(Date),
        }),
      })
    );
    stopInProcessCron();
  });
  it("stops cron on SIGTERM without calling process.exit", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PHASE", "");
    const listeners = new Map<string, () => void>();
    vi.spyOn(process, "once").mockImplementation(((event: string, cb: () => void) => {
      listeners.set(event, cb);
      return process;
    }) as typeof process.once);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("premature exit");
    });
    const { register } = await import("@/instrumentation");
    await register();
    listeners.get("SIGTERM")!();
    expect(m.stop).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
  it("makes swallowed failures visible without raw error text", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");
    expect(logSafe("fixture")(new Error("erased@example.test private-token"))).toBeNull();
    expect(warning).toHaveBeenCalled();
    const output = JSON.stringify(warning.mock.calls);
    expect(output).toContain("warn");
    expect(output).not.toMatch(/erased@example|private-token/);
  });
});

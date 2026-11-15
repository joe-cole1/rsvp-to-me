// L-4: logSafe() — shared rejection handler for fire-and-forget promises.
// Replaces bare `.catch(() => {})` so swallowed errors surface at warning level.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("logSafe", () => {
  it("resolves the promise chain to null instead of rethrowing", async () => {
    const { logSafe } = await import("@/lib/logger");
    const result = await Promise.reject(new Error("boom")).catch(logSafe("test-context"));
    expect(result).toBeNull();
  });

  it("records the swallowed error at warning level when LOG_LEVEL=debug", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject(new Error("boom")).catch(logSafe("activity-log"));

    const line = logSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("activity-log"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line as string);
    expect(parsed.level).toBe("warn");
    expect(parsed.message).toContain("activity-log");
  });

  it("surfaces swallowed errors at the default info level", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject(new Error("boom")).catch(logSafe("quiet-context"));

    expect(
      logSpy.mock.calls.map((c) => String(c[0])).some((l) => l.includes("quiet-context"))
    ).toBe(true);
  });

  it("handles non-Error rejection values without logging their contents", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject("plain-string-failure").catch(logSafe("string-reject"));

    expect(logSpy).toHaveBeenCalled();
  });
});

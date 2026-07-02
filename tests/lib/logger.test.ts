// L-4: logSafe() — shared rejection handler for fire-and-forget promises.
// Replaces bare `.catch(() => {})` so swallowed errors surface at debug level.

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

  it("records the swallowed error at debug level when LOG_LEVEL=debug", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject(new Error("boom")).catch(logSafe("activity-log"));

    const line = logSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("activity-log"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line as string);
    expect(parsed.level).toBe("debug");
    expect(parsed.message).toContain("activity-log");
  });

  it("is silent at the default info level", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject(new Error("boom")).catch(logSafe("quiet-context"));

    expect(
      logSpy.mock.calls.map((c) => String(c[0])).some((l) => l.includes("quiet-context"))
    ).toBe(false);
  });

  it("stringifies non-Error rejection values", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logSafe } = await import("@/lib/logger");

    await Promise.reject("plain-string-failure").catch(logSafe("string-reject"));

    expect(logSpy).toHaveBeenCalled();
  });
});

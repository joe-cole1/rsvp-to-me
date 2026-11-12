// Root cause (#844): action-created session cookies ignored DISABLE_HSTS, so
// code sign-in over a production HTTP installation could not persist a session.
import { afterEach, describe, expect, it, vi } from "vitest";
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("@/lib/db", () => ({ db: { session: { create: vi.fn() } } }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("iron-session", () => ({ sealData: async () => "sealed" }));
import { createSession } from "@/lib/session";
afterEach(() => {
  vi.unstubAllEnvs();
  set.mockClear();
});
describe("code sign-in session cookie transport", () => {
  it.each([
    ["production", "true", false],
    ["production", "false", true],
    ["production", undefined, true],
    ["development", undefined, false],
  ] as const)("NODE_ENV=%s DISABLE_HSTS=%s gives secure=%s", async (mode, disabled, secure) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("DISABLE_HSTS", disabled);
    await createSession({ userId: "fixture-user", email: "fixture@example.test", role: "HOST" });
    expect(set).toHaveBeenCalledWith(
      "rsvp-session",
      "sealed",
      expect.objectContaining({ secure, httpOnly: true, sameSite: "lax" })
    );
  });
});

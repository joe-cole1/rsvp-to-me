// #851: Compose forced rich sample data on, and seeding silently installed a
// well-known invite code when HOST_INVITE_CODE was absent. Require explicit
// configuration before any writes and keep baseline-only seeding idempotent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  hostInviteCode: { upsert: vi.fn().mockResolvedValue({}) },
  themePreset: { upsert: vi.fn().mockResolvedValue({}) },
  user: { upsert: vi.fn().mockResolvedValue({}) },
  event: { count: vi.fn() },
  $disconnect: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/db", () => ({ db }));
vi.mock("dotenv/config", () => ({}));

describe("explicit baseline seed configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("SEED_TEST_DATA", "false");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([undefined, "", "   "])(
    "rejects missing/empty invite code %s before writing",
    async (code) => {
      vi.stubEnv("HOST_INVITE_CODE", code);
      await import("../../prisma/seed");
      await vi.waitFor(() => expect(db.$disconnect).toHaveBeenCalled());
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("HOST_INVITE_CODE") })
      );
      expect(db.hostInviteCode.upsert).not.toHaveBeenCalled();
      expect(db.themePreset.upsert).not.toHaveBeenCalled();
      expect(db.user.upsert).not.toHaveBeenCalled();
    }
  );

  it("upserts the explicit code and baseline rows without sample accounts or secret logging", async () => {
    const code = "seed-fixture-explicit-invite";
    vi.stubEnv("HOST_INVITE_CODE", `  ${code}  `);
    await import("../../prisma/seed");
    await vi.waitFor(() => expect(db.$disconnect).toHaveBeenCalled());
    expect(process.exit).not.toHaveBeenCalled();
    expect(db.hostInviteCode.upsert).toHaveBeenCalledWith({
      where: { code },
      update: {},
      create: { code, note: "Default invite code from seed" },
    });
    expect(db.themePreset.upsert).toHaveBeenCalled();
    expect(db.user.upsert).toHaveBeenCalledTimes(1);
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "system" } })
    );
    expect(db.event.count).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(code);
  });
});

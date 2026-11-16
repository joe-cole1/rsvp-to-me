// #851/#877: production startup previously seeded baseline rows even with sample
// data disabled. Seeding now installs demo content only after explicit opt-in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  hostInviteCode: { upsert: vi.fn().mockResolvedValue({}) },
  themePreset: { upsert: vi.fn().mockResolvedValue({}) },
  user: { upsert: vi.fn().mockRejectedValue(new Error("fixture stop")) },
  event: { count: vi.fn().mockResolvedValue(0) },
  $disconnect: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/db", () => ({ db }));
vi.mock("dotenv/config", () => ({}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("HOST_INVITE_CODE", undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function seed() {
  await import("../../prisma/seed");
  await vi.waitFor(() => expect(db.$disconnect).toHaveBeenCalled());
}
describe("demo-only seed configuration", () => {
  it.each([undefined, "", "false"])(
    "performs no database reads/writes when SEED_TEST_DATA=%s",
    async (value) => {
      vi.stubEnv("SEED_TEST_DATA", value);
      await seed();
      expect(process.exit).not.toHaveBeenCalled();
      expect(db.event.count).not.toHaveBeenCalled();
      expect(db.hostInviteCode.upsert).not.toHaveBeenCalled();
      expect(db.themePreset.upsert).not.toHaveBeenCalled();
      expect(db.user.upsert).not.toHaveBeenCalled();
    }
  );
  it("does not modify an instance that already has events", async () => {
    vi.stubEnv("SEED_TEST_DATA", "true");
    db.event.count.mockResolvedValueOnce(1);
    await seed();
    expect(process.exit).not.toHaveBeenCalled();
    expect(db.themePreset.upsert).not.toHaveBeenCalled();
    expect(db.user.upsert).not.toHaveBeenCalled();
    expect(db.hostInviteCode.upsert).not.toHaveBeenCalled();
  });
  it("preserves existing preset values and never installs an operational invite or SYSTEM", async () => {
    vi.stubEnv("SEED_TEST_DATA", "true");
    await seed();
    expect(db.themePreset.upsert).toHaveBeenCalled();
    for (const [args] of db.themePreset.upsert.mock.calls) expect(args.update).toEqual({});
    expect(db.hostInviteCode.upsert).not.toHaveBeenCalled();
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "admin@test.com" } })
    );
    expect(db.user.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "system" } })
    );
  });
});

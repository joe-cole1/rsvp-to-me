// #877 root cause: baseline seeding created SYSTEM as ADMIN, preventing bootstrap.
// Setup must prove the configured email, serialize promotion, and need no invite/seed.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: { count: vi.fn(), update: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  transaction: vi.fn(),
  execute: vi.fn(),
  challenge: vi.fn(),
  mail: vi.fn(),
  captcha: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { user: m.user, $transaction: m.transaction } }));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), getSession: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
  headers: async () => ({ get: vi.fn() }),
}));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.mail }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: vi.fn() }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  createLoginChallenge: m.challenge,
}));
import { completeVerifiedAdminSetup, promoteInitialAdmin } from "@/lib/admin-promotion";
import { getSetupState } from "@/lib/setup-state";
import { startAdminSetupAction } from "@/app/actions/auth";
const guest = { id: "initial", email: "owner@example.test", role: "GUEST", name: null };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("INITIAL_ADMIN_EMAIL", " owner@example.test ");
  vi.stubEnv("TRUSTED_IP_HEADER", "");
  m.transaction.mockImplementation(async (run) => run({ user: m.user, $executeRaw: m.execute }));
  m.user.count.mockResolvedValue(0);
  m.user.findUnique.mockResolvedValue(guest);
  m.user.update.mockImplementation(async ({ data }) => ({ ...guest, ...data }));
  m.rate.mockResolvedValue({ success: true });
  m.challenge.mockResolvedValue({
    link: "https://example.test/auth/verify?token=fixture",
    code: "012345",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("#877 initial administrator", () => {
  it("discovers setup without exposing the configured email", async () => {
    expect(await getSetupState()).toEqual({ required: true, configured: true });
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "");
    expect(await getSetupState()).toEqual({ required: true, configured: false });
    m.user.count.mockResolvedValue(1);
    expect(await getSetupState()).toEqual({ required: false, configured: false });
  });
  it("excludes only SYSTEM from the locked promotion count", async () => {
    expect(await promoteInitialAdmin("initial", " OWNER@EXAMPLE.TEST ")).toBe(true);
    expect(m.user.count).toHaveBeenCalledWith({ where: { role: "ADMIN", id: { not: "system" } } });
    expect(m.execute.mock.invocationCallOrder[0]).toBeLessThan(
      m.user.count.mock.invocationCallOrder[0]
    );
    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: "initial" },
      data: { role: "ADMIN" },
    });
  });
  it("does not promote if a real administrator exists", async () => {
    m.user.count.mockResolvedValue(1);
    expect(await promoteInitialAdmin("initial", guest.email)).toBe(false);
    expect(await completeVerifiedAdminSetup("initial", "Owner")).toBeNull();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "other@example.test"])(
    "rejects ineligible verified email %s",
    async (email) => {
      m.user.findUnique.mockResolvedValue({ ...guest, email });
      expect(await completeVerifiedAdminSetup("initial", "Owner")).toBeNull();
      expect(m.user.update).not.toHaveBeenCalled();
    }
  );
  it("checks current configuration again at proof time", async () => {
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "changed@example.test");
    expect(await completeVerifiedAdminSetup("initial", "Owner")).toBeNull();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("applies the name only to a verified guest account", async () => {
    expect(await completeVerifiedAdminSetup("initial", "Owner")).toMatchObject({
      role: "ADMIN",
      name: "Owner",
    });
    m.user.findUnique.mockResolvedValue({ ...guest, role: "HOST", name: "Existing name" });
    await completeVerifiedAdminSetup("initial", "Unverified replacement");
    expect(m.user.update).toHaveBeenLastCalledWith({
      where: { id: "initial" },
      data: { role: "ADMIN" },
    });
  });
  it("accepts an already completed setup without overwriting its profile", async () => {
    m.user.findUnique.mockResolvedValue({ ...guest, role: "ADMIN" });
    expect(await completeVerifiedAdminSetup("initial", "Other name")).toMatchObject({
      role: "ADMIN",
    });
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("cannot promote SYSTEM or a missing account", async () => {
    expect(await promoteInitialAdmin("system", guest.email)).toBe(false);
    m.user.findUnique.mockResolvedValue({ ...guest, id: "system" });
    expect(await completeVerifiedAdminSetup("system", "System")).toBeNull();
    m.user.findUnique.mockResolvedValue(null);
    expect(await completeVerifiedAdminSetup("missing", "Owner")).toBeNull();
    expect(m.user.update).not.toHaveBeenCalled();
  });
});
describe("#877 setup request", () => {
  it("issues proof without assigning a role or installing an invite", async () => {
    expect(await startAdminSetupAction("OWNER@example.test", "Owner", "captcha")).toEqual({
      success: true,
    });
    expect(m.captcha).toHaveBeenCalledWith("register", "captcha");
    expect(m.user.upsert).toHaveBeenCalledWith({
      where: { email: guest.email },
      create: { email: guest.email, role: "GUEST" },
      update: {},
    });
    expect(m.challenge).toHaveBeenCalledWith(
      guest.email,
      "/admin",
      JSON.stringify({ registrationName: "Owner", initialAdminSetup: true })
    );
    expect(m.mail).toHaveBeenCalled();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it.each(["other@example.test", "owner@example.test"])(
    "does not disclose eligibility for %s",
    async (email) => {
      m.user.count.mockResolvedValue(1);
      expect(await startAdminSetupAction(email, "Owner")).toEqual({ success: true });
      expect(m.user.upsert).not.toHaveBeenCalled();
      expect(m.mail).not.toHaveBeenCalled();
    }
  );
  it("does nothing without configured admin email", async () => {
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "");
    expect(await startAdminSetupAction(guest.email, "Owner")).toEqual({ success: true });
    expect(m.user.upsert).not.toHaveBeenCalled();
  });
  it("reports delivery failure and can retry without granting privileges", async () => {
    m.mail.mockRejectedValueOnce(new Error("sensitive provider detail"));
    expect(await startAdminSetupAction(guest.email, "Owner")).toMatchObject({
      success: false,
      error: expect.not.stringContaining("sensitive"),
    });
    expect(await startAdminSetupAction(guest.email, "Owner")).toEqual({ success: true });
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("rejects invalid input, rate limits and CAPTCHA failures", async () => {
    expect(await startAdminSetupAction("bad", "")).toMatchObject({ success: false });
    m.rate.mockResolvedValue({ success: false });
    expect(await startAdminSetupAction(guest.email, "Owner")).toMatchObject({ success: false });
    m.captcha.mockRejectedValue(new Error("captcha failed"));
    await expect(startAdminSetupAction(guest.email, "Owner")).rejects.toThrow("captcha failed");
    expect(m.user.upsert).not.toHaveBeenCalled();
  });
});

// #877: SYSTEM's seeded ADMIN role blocked bootstrap, and production setup
// depended on demo seeding. Exercise real PostgreSQL proof/promotion and deletion.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db, truncateAll } from "@/tests/integration/helpers/db";
import { startAdminSetupAction } from "@/app/actions/auth";
import { createLoginChallenge, verifyMagicToken, verifySignInCode } from "@/lib/auth";
import { promoteInitialAdmin } from "@/lib/admin-promotion";
import { performImmediateUserDeletion } from "@/lib/account-deletion";
import { GET } from "@/app/auth/verify/route";
const m = vi.hoisted(() => ({ mail: vi.fn(), session: vi.fn(), seal: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.mail }));
vi.mock("@/lib/session", () => ({
  createSession: m.session,
  revokeUserSessions: vi.fn(),
  sealSession: m.seal,
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 604800,
}));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/uploads", () => ({ releaseUpload: vi.fn(), releaseAccountUploads: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
  headers: async () => ({ get: vi.fn() }),
}));
const email = "initial@example.test";
beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
  vi.stubEnv("INITIAL_ADMIN_EMAIL", email);
  vi.stubEnv("OPEN_REGISTRATION", "false");
  vi.stubEnv("TRUSTED_IP_HEADER", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  m.seal.mockResolvedValue("fixture-session");
});
afterEach(() => vi.unstubAllEnvs());
async function requestSetup() {
  expect(await startAdminSetupAction(email, "First owner")).toEqual({ success: true });
  const [, link, , code] = m.mail.mock.calls.at(-1)!;
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.role).toBe("GUEST");
  expect(user.name).toBeNull();
  return {
    user,
    code: code as string,
    link: link as string,
    token: new URL(link).searchParams.get("token")!,
  };
}
describe("#877 seed-free administrator setup", () => {
  it.each(["link", "code"])(
    "completes %s setup with a legacy SYSTEM ADMIN and no host invites",
    async (method) => {
      await db.user.create({ data: { id: "system", role: "ADMIN", name: "System" } });
      const challenge = await requestSetup();
      expect(await db.hostInviteCode.count()).toBe(0);
      if (method === "link") {
        const response = await GET(new NextRequest(challenge.link));
        expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
        expect(m.seal).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
      } else {
        expect(await verifySignInCode(email, challenge.code)).toBe(true);
        expect(m.session).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
      }
      expect(await db.user.findUniqueOrThrow({ where: { id: challenge.user.id } })).toMatchObject({
        role: "ADMIN",
        name: "First owner",
      });
      expect(await verifyMagicToken(challenge.token)).toBe(false);
      expect(await verifySignInCode(email, challenge.code)).toBe(false);
    }
  );
  it("serializes simultaneous setup link/code verification", async () => {
    const challenge = await requestSetup();
    const results = await Promise.all([
      verifyMagicToken(challenge.token),
      verifySignInCode(email, challenge.code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(m.session).toHaveBeenCalledTimes(1);
    expect(await db.user.count({ where: { role: "ADMIN", id: { not: "system" } } })).toBe(1);
  });
  it("blocks a stale setup claim when another real administrator appears", async () => {
    const challenge = await requestSetup();
    await db.user.create({ data: { email: "other@example.test", role: "ADMIN" } });
    expect(await verifyMagicToken(challenge.token)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("GUEST");
    expect(m.session).not.toHaveBeenCalled();
  });
  it("checks changed configuration again at verification", async () => {
    const challenge = await requestSetup();
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "changed@example.test");
    expect(await verifySignInCode(email, challenge.code)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("GUEST");
  });
  it("preserves setup intent across resend and rejects expired credentials", async () => {
    const challenge = await requestSetup();
    const resent = (await createLoginChallenge(email, "/admin"))!;
    expect(await verifySignInCode(email, challenge.code)).toBe(false);
    expect(await verifyMagicToken(challenge.token)).toBe(false);
    expect(await verifySignInCode(email, resent.code)).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).name).toBe("First owner");
    await truncateAll();
    const expired = await requestSetup();
    await db.magicToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifyMagicToken(expired.token)).toBe(false);
    expect(await verifySignInCode(email, expired.code)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("GUEST");
  });
  it("retains the old verified-login bootstrap for an existing host", async () => {
    await db.user.create({ data: { id: "system", role: "ADMIN" } });
    const host = await db.user.create({ data: { email, role: "HOST" } });
    expect(await promoteInitialAdmin(host.id, email)).toBe(true);
    await db.user.update({ where: { id: host.id }, data: { role: "HOST" } });
    await db.user.create({ data: { email: "other@example.test", role: "ADMIN" } });
    expect(await promoteInitialAdmin(host.id, email)).toBe(false);
  });
  it("creates SYSTEM on demand before reassigning events during deletion", async () => {
    const user = await db.user.create({ data: { email, role: "HOST" } });
    const event = await db.event.create({
      data: {
        title: "Preserved event",
        slug: "877-deletion",
        hostId: user.id,
        startAt: new Date(),
      },
    });
    await performImmediateUserDeletion(user.id);
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).hostId).toBe("system");
    expect(await db.user.findUniqueOrThrow({ where: { id: "system" } })).toMatchObject({
      email: null,
      phone: null,
      role: "ADMIN",
    });
    // Re-running must not overwrite an existing SYSTEM record.
    await db.user.update({ where: { id: "system" }, data: { name: "Retained system name" } });
    await performImmediateUserDeletion(user.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: "system" } })).name).toBe(
      "Retained system name"
    );
  });
});

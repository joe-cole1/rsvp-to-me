import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken } from "@/lib/hash";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  account: {
    id: "u",
    email: "user@example.com",
    phone: null as string | null,
    role: "HOST",
    preferredLocale: null as string | null,
  },
  browser: undefined as string | undefined,
  type: "LOGIN",
  updateMany: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => state.account), updateMany: state.updateMany },
    magicToken: {
      findUnique: vi.fn(async () => ({
        id: "token",
        userId: "u",
        used: false,
        expiresAt: new Date(Date.now() + 60000),
        type: state.type,
      })),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () =>
        state.type === "LOGIN"
          ? { id: "token", codeHash: hashToken("012345"), codeAttempts: 0 }
          : null
      ),
    },
    rSVP: { updateMany: vi.fn() },
    session: { create: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn) => {
      const { db } = await import("@/lib/db");
      return fn(db);
    }),
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.browser ? { value: state.browser } : undefined),
    set: state.set,
  }),
}));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  sealSession: vi.fn(async () => "sealed"),
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 600,
  getSession: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-promotion", () => ({ promoteInitialAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false, redisSet: vi.fn() }));
import { verifyMagicToken, verifySignInCode } from "@/lib/auth";
import { GET } from "@/app/auth/verify/route";
describe.each(["action", "route", "code"] as const)("verified LOGIN language via %s", (entry) => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.account.preferredLocale = null;
    state.browser = undefined;
    state.type = "LOGIN";
    state.updateMany.mockImplementation(async () => {
      state.account.preferredLocale = state.browser ?? null;
      return { count: 1 };
    });
  });
  async function verify() {
    if (entry !== "route") {
      expect(
        await (entry === "code"
          ? verifySignInCode(state.account.email, "012345")
          : verifyMagicToken("valid"))
      ).toBe(true);
      return null;
    }
    const request = new NextRequest("http://localhost:3000/auth/verify?token=valid", {
      headers: state.browser ? { cookie: "rsvp-locale=" + state.browser } : {},
    });
    return GET(request);
  }
  function cookie(response: Awaited<ReturnType<typeof verify>>) {
    return (
      response?.cookies.get("rsvp-locale")?.value ??
      state.set.mock.calls.find((c) => c[0] === "rsvp-locale")?.[1]
    );
  }
  it("saved account wins and syncs conflicting browser cookie", async () => {
    state.account.preferredLocale = "nl-NL";
    state.browser = "en-US";
    expect(cookie(await verify())).toBe("nl-NL");
    expect(state.updateMany).not.toHaveBeenCalled();
  });
  it("adopts valid cookie only with a conditional null update", async () => {
    state.browser = "nl-NL";
    expect(cookie(await verify())).toBe("nl-NL");
    expect(state.updateMany).toHaveBeenCalledWith({
      where: { id: "u", preferredLocale: null },
      data: { preferredLocale: "nl-NL" },
    });
  });
  it("leaves null account untouched without browser preference", async () => {
    expect(cookie(await verify())).toBeUndefined();
    expect(state.account.preferredLocale).toBeNull();
    expect(state.updateMany).not.toHaveBeenCalled();
  });
  it("never adopts for a non-LOGIN token", async () => {
    state.type = "EMAIL_CHANGE";
    state.browser = "nl-NL";
    if (entry !== "route")
      expect(
        await (entry === "code"
          ? verifySignInCode(state.account.email, "012345")
          : verifyMagicToken("valid"))
      ).toBe(false);
    else
      await GET(
        new NextRequest("http://localhost:3000/auth/verify?token=valid", {
          headers: { cookie: "rsvp-locale=nl-NL" },
        })
      );
    expect(state.updateMany).not.toHaveBeenCalled();
    expect(state.set).not.toHaveBeenCalled();
  });
});

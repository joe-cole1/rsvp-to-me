// SEC-48 — INITIAL_ADMIN_EMAIL promotion was reachable from ordinary sessions.
//
// Root cause (found 2026-07 STRIDE review): promoteInitialAdmin ran from
// getSession(), dashboard/profile reads, and LOGIN verification. A co-host
// invitation (or any other path able to mint a session for the configured
// email) could therefore gain ADMIN on its next session read without proving
// ownership through a LOGIN magic token. The fix makes successful LOGIN-token
// verification the exclusive promotion boundary while preserving both the
// configured-email match and no-existing-admin requirements.

import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockMagicTokenFindUnique,
  mockMagicTokenUpdate,
  mockUserFindUnique,
  mockUserCount,
  mockUserUpdate,
  mockSessionCreate,
  mockCoHostInvitationFindUnique,
  mockCoHostInvitationDelete,
  mockEventCoHostCreate,
  mockSealSession,
} = vi.hoisted(() => ({
  mockMagicTokenFindUnique: vi.fn(),
  mockMagicTokenUpdate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserCount: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockSessionCreate: vi.fn(),
  mockCoHostInvitationFindUnique: vi.fn(),
  mockCoHostInvitationDelete: vi.fn(),
  mockEventCoHostCreate: vi.fn(),
  mockSealSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    magicToken: {
      findUnique: mockMagicTokenFindUnique,
      update: mockMagicTokenUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
      count: mockUserCount,
      update: mockUserUpdate,
    },
    session: { create: mockSessionCreate },
    coHostInvitation: {
      findUnique: mockCoHostInvitationFindUnique,
      delete: mockCoHostInvitationDelete,
    },
    eventCoHost: { create: mockEventCoHostCreate },
  },
}));

vi.mock("@/lib/session", () => ({
  sealSession: mockSealSession,
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 604800,
}));

vi.mock("@/lib/auth", () => ({
  linkRsvpsToUser: vi.fn().mockResolvedValue(undefined),
  isSafeRedirect: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: vi.fn().mockReturnValue(false),
  redisSet: vi.fn(),
}));

import { GET as verifyLogin } from "@/app/auth/verify/route";
import { GET as verifyCoHost } from "@/app/auth/verify-cohost/route";

const ORIGINAL_INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const REPO_ROOT = process.cwd();

function loginRequest() {
  return new NextRequest("https://rsvp.example.com/auth/verify?token=raw-login-token");
}

function matchingHost() {
  return {
    id: "user-1",
    email: "bootstrap@example.com",
    phone: null,
    role: "HOST",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INITIAL_ADMIN_EMAIL = "bootstrap@example.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.example.com";
  mockMagicTokenFindUnique.mockResolvedValue({
    id: "login-token-1",
    userId: "user-1",
    type: "LOGIN",
    used: false,
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockMagicTokenUpdate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue(matchingHost());
  mockUserCount.mockResolvedValue(0);
  mockUserUpdate.mockResolvedValue({ ...matchingHost(), role: "ADMIN" });
  mockSessionCreate.mockResolvedValue({});
  mockSealSession.mockResolvedValue("sealed-session");
});

afterEach(() => {
  process.env.INITIAL_ADMIN_EMAIL = ORIGINAL_INITIAL_ADMIN_EMAIL;
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("SEC-48: initial-admin promotion is LOGIN-token-only", () => {
  it("promotes the matching bootstrap user after successful LOGIN verification", async () => {
    const response = await verifyLogin(loginRequest());

    expect(response.status).toBe(307);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" },
    });
    expect(mockSealSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", role: "ADMIN" })
    );
  });

  it("does not promote a verified LOGIN user whose email does not match", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...matchingHost(),
      email: "someone-else@example.com",
    });

    await verifyLogin(loginRequest());

    expect(mockUserCount).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSealSession).toHaveBeenCalledWith(expect.objectContaining({ role: "HOST" }));
  });

  it("does not promote the matching LOGIN user when an admin already exists", async () => {
    mockUserCount.mockResolvedValue(1);

    await verifyLogin(loginRequest());

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSealSession).toHaveBeenCalledWith(expect.objectContaining({ role: "HOST" }));
  });

  it("does not promote the configured email during co-host acceptance", async () => {
    mockCoHostInvitationFindUnique.mockResolvedValue({
      id: "cohost-invite-1",
      eventId: "event-1",
      email: "bootstrap@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      event: { slug: "party", title: "Party" },
    });
    mockEventCoHostCreate.mockResolvedValue({});
    mockCoHostInvitationDelete.mockResolvedValue({});

    const response = await verifyCoHost(
      new NextRequest("https://rsvp.example.com/auth/verify-cohost?token=raw-cohost-token")
    );

    expect(response.status).toBe(307);
    expect(mockUserCount).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSealSession).toHaveBeenCalledWith(expect.objectContaining({ role: "HOST" }));
  });

  it("keeps ordinary session, dashboard, and profile reads promotion-free", () => {
    for (const path of [
      "lib/session.ts",
      "app/(app)/dashboard/page.tsx",
      "app/actions/profile.ts",
      "app/auth/verify-cohost/route.ts",
      "app/auth/verify-change/route.ts",
    ]) {
      const source = readFileSync(join(REPO_ROOT, path), "utf8");
      expect(source, path).not.toContain("promoteInitialAdmin");
    }
  });

  it("keeps promotion wired only to the two verified LOGIN handlers", () => {
    for (const path of ["lib/auth.ts", "app/auth/verify/route.ts"]) {
      const source = readFileSync(join(REPO_ROOT, path), "utf8");
      expect(source, path).toContain("promoteInitialAdmin");
      expect(source, path).toContain('record.type !== "LOGIN"');
    }
  });
});

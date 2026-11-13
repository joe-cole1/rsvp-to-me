vi.mock("@/lib/notifications/lifecycle", () => ({
  retireChangedAccountConnection: vi.fn().mockResolvedValue(undefined),
}));
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the request-locale boundary; translation rendering remains the real English ICU catalog.
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return { ...actual, getRequestTranslator: () => actual.getTranslator("en-US") };
});

const {
  mockUserFindUnique,
  mockUserFindFirst,
  mockUserCreate,
  mockUserUpdate,
  mockUserCount,
  mockUserUpdateMany,
  mockMagicTokenCreate,
  mockMagicTokenUpdateMany,
  mockMagicTokenUpdate,
  mockMagicTokenFindUnique,
  mockMagicTokenFindFirst,
  mockExecuteRaw,
  mockRsvpUpdateMany,
  mockHostInviteCodeFindFirst,
  mockHostInviteCodeUpdate,
  mockSystemConfigFindUnique,
  mockTransaction,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockUserCount: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockMagicTokenCreate: vi.fn(),
  mockMagicTokenUpdateMany: vi.fn(),
  mockMagicTokenUpdate: vi.fn(),
  mockMagicTokenFindUnique: vi.fn(),
  mockMagicTokenFindFirst: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockRsvpUpdateMany: vi.fn(),
  mockHostInviteCodeFindFirst: vi.fn(),
  mockHostInviteCodeUpdate: vi.fn(),
  mockSystemConfigFindUnique: vi.fn(),
  mockTransaction: vi.fn((ops) => Promise.all(ops)),
  mockCreateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      create: mockUserCreate,
      update: mockUserUpdate,
      count: mockUserCount,
      updateMany: mockUserUpdateMany,
    },
    magicToken: {
      create: mockMagicTokenCreate,
      updateMany: mockMagicTokenUpdateMany,
      update: mockMagicTokenUpdate,
      findUnique: mockMagicTokenFindUnique,
      findFirst: mockMagicTokenFindFirst,
    },
    rSVP: {
      updateMany: mockRsvpUpdateMany,
    },
    hostInviteCode: {
      findFirst: mockHostInviteCodeFindFirst,
      update: mockHostInviteCodeUpdate,
    },
    systemConfig: {
      findUnique: mockSystemConfigFindUnique,
    },
    $transaction: mockTransaction,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })) }));
vi.mock("@/lib/session", () => ({
  createSession: mockCreateSession,
}));

import {
  createMagicLink,
  createLoginChallenge,
  verifySignInCode,
  isSafeRedirect,
  linkRsvpsToUser,
  verifyMagicToken,
  verifyChangeToken,
  registerHost,
  isOpenRegistrationActive,
} from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mockMagicTokenUpdateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation(async (ops) => {
    const { db } = await import("@/lib/db");
    return typeof ops === "function" ? ops(db) : Promise.all(ops);
  });
  process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
});

describe("isSafeRedirect", () => {
  it("accepts a normal relative path", () => {
    expect(isSafeRedirect("/e/panton-wine-night")).toBe(true);
  });

  it("accepts a relative path with query string", () => {
    expect(isSafeRedirect("/e/slug?foo=bar")).toBe(true);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeRedirect("//evil.com")).toBe(false);
  });

  it("rejects a backslash-prefixed path (browser normalises to //)", () => {
    expect(isSafeRedirect("/\\evil.com")).toBe(false);
  });

  it("rejects an absolute http URL", () => {
    expect(isSafeRedirect("http://evil.com")).toBe(false);
  });

  it("rejects an absolute https URL", () => {
    expect(isSafeRedirect("https://evil.com")).toBe(false);
  });

  it("rejects a javascript: URI", () => {
    expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeRedirect("")).toBe(false);
  });

  it("rejects a bare domain with no leading slash", () => {
    expect(isSafeRedirect("evil.com")).toBe(false);
  });

  it.each([
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "/\t\\evil.com",
    "/e/\u0000x",
    "/e/\u007f",
  ])("rejects control characters the URL parser strips or normalises: %j", (path) => {
    expect(isSafeRedirect(path)).toBe(false);
  });

  it("rejects a backslash anywhere in the path", () => {
    expect(isSafeRedirect("/e\\slug")).toBe(false);
  });

  it("accepts encoded characters and spaces that stay on the same origin", () => {
    expect(isSafeRedirect("/e/my%20slug?q=a b#rsvp")).toBe(true);
  });
});

describe("createMagicLink", () => {
  it("returns null when user not found by email", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await createMagicLink("test@example.com");
    expect(result).toBeNull();
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });

  it("returns null when user not found by phone", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await createMagicLink("+15551234567");
    expect(result).toBeNull();
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { phone: "+15551234567" },
    });
  });

  it("detects phone input and calls user.findUnique with normalized phone", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", phone: "+15551234567" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink(" (555) 123-4567 ");
    expect(result).toContain("/auth/verify?token=");
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { phone: "5551234567" },
    });
  });

  it("detects email input and calls user.findUnique with lowercase/trimmed email", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink(" USER@Example.com ");
    expect(result).toContain("/auth/verify?token=");
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("invalidates existing unused tokens via magicToken.updateMany", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockMagicTokenCreate.mockResolvedValue({});

    await createMagicLink("user@example.com");
    expect(mockMagicTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", used: false },
      data: { used: true },
    });
  });

  it("creates a new magicToken with 15-minute expiry", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink("user@example.com");
    expect(mockMagicTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(result).toMatch(new RegExp(`^http://localhost:3000/auth/verify\\?token=[a-f0-9]{64}$`));
  });

  it("stores the hashed token in the database, while returning the raw token in the URL", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink("user@example.com");
    expect(result).toBeDefined();

    const rawToken = result!.split("token=")[1];
    const { hashToken } = await import("@/lib/hash");
    const expectedHashedToken = hashToken(rawToken);

    expect(mockMagicTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        token: expectedHashedToken,
        expiresAt: expect.any(Date),
      }),
    });
  });

  it("appends encoded redirect param to the link when redirect is a safe relative path", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink("user@example.com", "/e/panton-wine-night");
    expect(result).toContain("&redirect=%2Fe%2Fpanton-wine-night");
  });

  it("omits redirect param from the link when redirect is unsafe (open redirect attempt)", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink("user@example.com", "//evil.com");
    expect(result).not.toContain("redirect");
  });

  it("omits redirect param from the link when redirect is not provided", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockMagicTokenCreate.mockResolvedValue({});

    const result = await createMagicLink("user@example.com");
    expect(result).not.toContain("redirect");
  });
});

describe("linkRsvpsToUser", () => {
  it("returns early when user is not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await linkRsvpsToUser("user-1");
    expect(mockRsvpUpdateMany).not.toHaveBeenCalled();
  });

  it("returns early when user has neither email nor phone", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: null, phone: null });
    await linkRsvpsToUser("user-1");
    expect(mockRsvpUpdateMany).not.toHaveBeenCalled();
  });

  it("matches RSVPs by guestEmail when user has email only", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com", phone: null });
    mockRsvpUpdateMany.mockResolvedValue({ count: 1 });

    await linkRsvpsToUser("user-1");
    expect(mockRsvpUpdateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { OR: [{ guestEmail: "user@example.com" }] },
          { OR: [{ userId: { not: "user-1" } }, { userId: null }] },
        ],
      },
      data: { userId: "user-1" },
    });
  });

  it("matches RSVPs by guestPhone (normalized) when user has phone only", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: null, phone: " (555) 123-4567 " });
    mockRsvpUpdateMany.mockResolvedValue({ count: 1 });

    await linkRsvpsToUser("user-1");
    expect(mockRsvpUpdateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { OR: [{ guestPhone: "5551234567" }] },
          { OR: [{ userId: { not: "user-1" } }, { userId: null }] },
        ],
      },
      data: { userId: "user-1" },
    });
  });

  it("builds an OR condition when user has both email and phone", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      phone: "+15551234567",
    });
    mockRsvpUpdateMany.mockResolvedValue({ count: 2 });

    await linkRsvpsToUser("user-1");
    expect(mockRsvpUpdateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { OR: [{ guestEmail: "user@example.com" }, { guestPhone: "+15551234567" }] },
          { OR: [{ userId: { not: "user-1" } }, { userId: null }] },
        ],
      },
      data: { userId: "user-1" },
    });
  });
});

describe("verifyMagicToken", () => {
  const token = "tok-123";
  const future = new Date(Date.now() + 1000 * 600);
  const past = new Date(Date.now() - 1000 * 600);

  it("returns false when token not found", async () => {
    mockMagicTokenFindUnique.mockResolvedValue(null);
    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("returns false when token is already used", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "1",
      used: true,
      expiresAt: future,
      type: "LOGIN",
    });
    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("returns false when token is expired", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "1",
      used: false,
      expiresAt: past,
      type: "LOGIN",
    });
    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("returns false when user is not found after token lookup", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "1",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "LOGIN",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue(null);

    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("marks token as used, calls linkRsvpsToUser, createSession, and returns true on success", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "LOGIN",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com", role: "HOST" });
    mockUserCount.mockResolvedValue(1);

    const result = await verifyMagicToken(token);
    expect(result).toBe(true);
    expect(mockMagicTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: "tok-id", used: false },
      data: { used: true },
    });
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
    });
  });

  it("promotes user to ADMIN when email matches INITIAL_ADMIN_EMAIL and no admins exist", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "LOGIN",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      role: "HOST",
    });
    mockUserCount.mockResolvedValue(0);
    mockUserUpdate.mockResolvedValue({});

    const result = await verifyMagicToken(token);
    expect(result).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" },
    });
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "admin@example.com",
      role: "ADMIN",
    });
  });

  it("does NOT promote when admins already exist", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "LOGIN",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      role: "HOST",
    });
    mockUserCount.mockResolvedValue(1);

    const result = await verifyMagicToken(token);
    expect(result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "admin@example.com",
      role: "HOST",
    });
  });

  it("returns false when token type is not LOGIN", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "EMAIL_CHANGE",
    });

    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
    expect(mockMagicTokenUpdate).not.toHaveBeenCalled();
  });
});

describe("verifyChangeToken", () => {
  const token = "tok-123";
  const future = new Date(Date.now() + 1000 * 600);

  it("returns error for non-existent / used / expired token", async () => {
    mockMagicTokenFindUnique.mockResolvedValue(null);
    const result = await verifyChangeToken(token);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid, used, or expired verification link.");
  });

  it("returns error when token type is LOGIN", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "1",
      used: false,
      expiresAt: future,
      type: "LOGIN",
    });
    const result = await verifyChangeToken(token);
    expect(result.success).toBe(false);
    expect(result.error).toContain("profile updates");
  });

  it("EMAIL_CHANGE: updates account email and links matching RSVPs without replacing event contacts", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "EMAIL_CHANGE",
      metadata: "new@example.com",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", role: "HOST", email: "old@example.com" });
    mockUserFindFirst.mockResolvedValue(null); // email not taken
    mockUserUpdate.mockResolvedValue({});
    mockRsvpUpdateMany.mockResolvedValue({ count: 1 });

    const result = await verifyChangeToken(token);
    expect(result).toEqual({ success: true, type: "EMAIL", newValue: "new@example.com" });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "new@example.com" },
    });
    expect(mockRsvpUpdateMany.mock.calls.every(([query]) => !("guestEmail" in query.data))).toBe(
      true
    );
  });

  it("EMAIL_CHANGE: returns error if another user already owns the new email", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "tok-id",
      used: false,
      expiresAt: future,
      userId: "user-1",
      type: "EMAIL_CHANGE",
      metadata: "taken@example.com",
    });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", role: "HOST", email: "old@example.com" });
    mockUserFindFirst.mockResolvedValue({ id: "user-2" }); // email taken

    const result = await verifyChangeToken(token);
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });
});

describe("registerHost", () => {
  const inviteCode = "code-123";
  const email = "test@example.com";
  const name = "Joe";

  it("returns error when existing HOST tries to re-register", async () => {
    mockSystemConfigFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ id: "user-1", role: "HOST" });

    const result = await registerHost(email, name, inviteCode);
    expect(result.success).toBe(false);
    expect(result.error).toContain("exists");
  });

  it("upgrades existing GUEST to HOST under open registration (no invite code)", async () => {
    // Open registration active
    mockSystemConfigFindUnique.mockResolvedValue({ key: "open_registration", value: "true" });
    mockUserFindUnique.mockResolvedValue({ id: "user-1", role: "GUEST" });
    mockUserUpdate.mockResolvedValue({});

    const result = await registerHost(email, name, "");
    expect(result.success).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name, role: "HOST" },
    });
  });

  it("upgrades existing GUEST to HOST with valid invite code, increments uses in $transaction", async () => {
    mockSystemConfigFindUnique.mockResolvedValue(null);
    process.env.OPEN_REGISTRATION = "false";
    mockUserFindUnique.mockResolvedValue({ id: "user-1", role: "GUEST" });
    mockHostInviteCodeFindFirst.mockResolvedValue({ id: "code-id", code: inviteCode });
    mockTransaction.mockResolvedValue([{}, {}]);

    const result = await registerHost(email, name, inviteCode);
    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });
});

describe("isOpenRegistrationActive", () => {
  it("returns true when SystemConfig has open_registration='true'", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ key: "open_registration", value: "true" });
    const result = await isOpenRegistrationActive();
    expect(result).toBe(true);
  });

  it("returns false when SystemConfig has open_registration='false'", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ key: "open_registration", value: "false" });
    const result = await isOpenRegistrationActive();
    expect(result).toBe(false);
  });
});

describe("sign-in code challenges (#844)", () => {
  const user = { id: "code-user", email: "code@example.com", phone: null, role: "HOST" };
  beforeEach(() => {
    mockUserFindUnique.mockResolvedValue(user);
    mockMagicTokenFindFirst.mockResolvedValue(null);
  });
  it("stores hashes for a paired link and six-digit code with one 15-minute expiry", async () => {
    const { hashToken } = await import("@/lib/hash");
    const before = Date.now();
    const challenge = await createLoginChallenge(" CODE@example.com ");
    expect(challenge?.code).toMatch(/^\d{6}$/);
    const rawToken = new URL(challenge!.link).searchParams.get("token")!;
    const data = mockMagicTokenCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      type: "LOGIN",
      codeHash: hashToken(challenge!.code),
      token: hashToken(rawToken),
      codeAttempts: 0,
    });
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    expect(mockExecuteRaw.mock.calls[0][1]).toBe("login-code:code-user");
  });
  it.each(["12345", "1234567", "12a456", "１２３４５６"])(
    "rejects invalid format %s before lookup",
    async (code) => {
      expect(await verifySignInCode("code@example.com", code)).toBe(false);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    }
  );
  it("rejects unknown accounts and missing/expired challenges without sessions", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    expect(await verifySignInCode("missing@example.com", "000000")).toBe(false);
    expect(await verifySignInCode("code@example.com", "000000")).toBe(false);
    expect(mockMagicTokenFindFirst).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        type: "LOGIN",
        used: false,
        expiresAt: { gt: expect.any(Date) },
        codeHash: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
  it.each([0, 3, 4])("counts a wrong attempt from %i and retires the fifth", async (attempts) => {
    const { hashToken } = await import("@/lib/hash");
    mockMagicTokenFindFirst.mockResolvedValue({
      id: "code-token",
      codeHash: hashToken("012345"),
      codeAttempts: attempts,
    });
    expect(await verifySignInCode("code@example.com", "999999")).toBe(false);
    expect(mockMagicTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: "code-token", used: false },
      data: { codeAttempts: { increment: 1 }, ...(attempts === 4 ? { used: true } : {}) },
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
  it("rejects locked challenges even when the code matches", async () => {
    const { hashToken } = await import("@/lib/hash");
    mockMagicTokenFindFirst.mockResolvedValue({
      id: "code-token",
      codeHash: hashToken("012345"),
      codeAttempts: 5,
    });
    expect(await verifySignInCode("code@example.com", "012345")).toBe(false);
    expect(mockMagicTokenUpdateMany).not.toHaveBeenCalled();
  });
  it("accepts leading zeros, links RSVPs and creates a session only after atomic consumption", async () => {
    const { hashToken } = await import("@/lib/hash");
    mockMagicTokenFindFirst.mockResolvedValue({
      id: "code-token",
      codeHash: hashToken("012345"),
      codeAttempts: 0,
    });
    expect(await verifySignInCode(" CODE@example.com ", "012345")).toBe(true);
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(mockMagicTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: "code-token", used: false },
      data: { used: true, codeAttempts: { increment: 1 } },
    });
    expect(mockRsvpUpdateMany).toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: user.id,
      email: user.email,
      role: "HOST",
    });
  });
  it("normalizes phone lookup", async () => {
    await verifySignInCode(" +1 (555) 123-4567 ", "012345");
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { phone: "+15551234567" } });
  });
  it("does not create a session if the paired link won consumption", async () => {
    const { hashToken } = await import("@/lib/hash");
    mockMagicTokenFindFirst.mockResolvedValue({
      id: "code-token",
      codeHash: hashToken("012345"),
      codeAttempts: 0,
    });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    expect(await verifySignInCode(user.email, "012345")).toBe(false);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
  it("does not create a session if the paired code won link consumption", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({
      id: "code-token",
      userId: user.id,
      type: "LOGIN",
      used: false,
      expiresAt: new Date(Date.now() + 60000),
    });
    mockMagicTokenUpdateMany.mockResolvedValue({ count: 0 });
    expect(await verifyMagicToken("paired-link")).toBe(false);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
  it("promotes the initial admin only after a verified LOGIN code", async () => {
    const { hashToken } = await import("@/lib/hash");
    mockUserFindUnique.mockResolvedValue({ ...user, email: "admin@example.com" });
    mockUserCount.mockResolvedValue(0);
    mockMagicTokenFindFirst.mockResolvedValue({
      id: "code-token",
      codeHash: hashToken("012345"),
      codeAttempts: 0,
    });
    expect(await verifySignInCode("admin@example.com", "012345")).toBe(true);
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
  });
});

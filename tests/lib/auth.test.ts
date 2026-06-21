import { describe, it, expect, vi, beforeEach } from "vitest";

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
  },
}));

vi.mock("@/lib/session", () => ({
  createSession: mockCreateSession,
}));

import {
  createMagicLink,
  linkRsvpsToUser,
  verifyMagicToken,
  verifyChangeToken,
  registerHost,
  isOpenRegistrationActive,
} from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
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
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com", phone: "+15551234567" });
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
    mockMagicTokenFindUnique.mockResolvedValue({ id: "1", used: true, expiresAt: future });
    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("returns false when token is expired", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({ id: "1", used: false, expiresAt: past });
    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("returns false when user is not found after token lookup", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({ id: "1", used: false, expiresAt: future, userId: "user-1" });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue(null);

    const result = await verifyMagicToken(token);
    expect(result).toBe(false);
  });

  it("marks token as used, calls linkRsvpsToUser, createSession, and returns true on success", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({ id: "tok-id", used: false, expiresAt: future, userId: "user-1" });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com", role: "HOST" });
    mockUserCount.mockResolvedValue(1);

    const result = await verifyMagicToken(token);
    expect(result).toBe(true);
    expect(mockMagicTokenUpdate).toHaveBeenCalledWith({
      where: { id: "tok-id" },
      data: { used: true },
    });
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      role: "HOST",
    });
  });

  it("promotes user to ADMIN when email matches INITIAL_ADMIN_EMAIL and no admins exist", async () => {
    mockMagicTokenFindUnique.mockResolvedValue({ id: "tok-id", used: false, expiresAt: future, userId: "user-1" });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "admin@example.com", role: "HOST" });
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
    mockMagicTokenFindUnique.mockResolvedValue({ id: "tok-id", used: false, expiresAt: future, userId: "user-1" });
    mockMagicTokenUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "admin@example.com", role: "HOST" });
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
    mockMagicTokenFindUnique.mockResolvedValue({ id: "1", used: false, expiresAt: future, type: "LOGIN" });
    const result = await verifyChangeToken(token);
    expect(result.success).toBe(false);
    expect(result.error).toContain("profile updates");
  });

  it("EMAIL_CHANGE: updates user.email, updates RSVPs guestEmail, calls linkRsvpsToUser, calls createSession", async () => {
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
    expect(mockRsvpUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { guestEmail: "new@example.com" },
    });
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

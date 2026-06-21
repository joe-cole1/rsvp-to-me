import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUniqueMagicToken,
  mockUpdateMagicToken,
  mockFindUniqueUser,
  mockFindFirstUser,
  mockUpdateUser,
  mockUpdateManyRsvps,
  mockLinkRsvpsToUser,
  mockSealSession,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockFindUniqueMagicToken: vi.fn(),
  mockUpdateMagicToken: vi.fn(),
  mockFindUniqueUser: vi.fn(),
  mockFindFirstUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUpdateManyRsvps: vi.fn(),
  mockLinkRsvpsToUser: vi.fn(),
  mockSealSession: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    magicToken: {
      findUnique: mockFindUniqueMagicToken,
      update: mockUpdateMagicToken,
    },
    user: {
      findUnique: mockFindUniqueUser,
      findFirst: mockFindFirstUser,
      update: mockUpdateUser,
    },
    rSVP: {
      updateMany: mockUpdateManyRsvps,
    },
    session: {
      create: mockCreateSession,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  sealSession: mockSealSession,
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 2592000,
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: vi.fn().mockReturnValue(false),
  redisSet: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  linkRsvpsToUser: mockLinkRsvpsToUser,
}));

import { GET } from "@/app/auth/verify-change/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/auth/verify-change?token=${token}`
    : "http://localhost:3000/auth/verify-change";
  return new NextRequest(url);
}

const futureDate = new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

describe("GET /auth/verify-change", () => {
  it("redirects to profile with error when no token provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/profile?error=invalid-token");
  });

  it("redirects with error when token is invalid or expired", async () => {
    mockFindUniqueMagicToken.mockResolvedValue(null);
    const res = await GET(makeRequest("bad-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid-token");
  });

  it("redirects with error when token is longer than 128 chars (length guard)", async () => {
    const longToken = "a".repeat(129);
    const res = await GET(makeRequest(longToken));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid-token");
    expect(mockFindUniqueMagicToken).not.toHaveBeenCalled();
  });

  it("updates token, updates email/phone, links RSVPs, sets cookie and redirects on success", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      id: "tok-id",
      token: "valid-token",
      used: false,
      expiresAt: futureDate,
      userId: "user1",
      type: "EMAIL_CHANGE",
      metadata: "new@example.com",
    });
    mockUpdateMagicToken.mockResolvedValue({});
    mockFindUniqueUser.mockResolvedValue({ id: "user1", role: "HOST" });
    mockFindFirstUser.mockResolvedValue(null); // not taken
    mockUpdateUser.mockResolvedValue({});
    mockUpdateManyRsvps.mockResolvedValue({ count: 1 });
    mockLinkRsvpsToUser.mockResolvedValue(undefined);
    mockSealSession.mockResolvedValue("sealed-cookie-val");

    const res = await GET(makeRequest("valid-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/profile?verified=1");
    expect(res.headers.get("set-cookie")).toContain("rsvp-session=sealed-cookie-val");
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { email: "new@example.com" },
    });
  });
});

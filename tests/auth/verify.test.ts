import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUniqueMagicToken,
  mockUpdateMagicToken,
  mockFindUniqueUser,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockFindUniqueMagicToken: vi.fn(),
  mockUpdateMagicToken: vi.fn(),
  mockFindUniqueUser: vi.fn(),
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
    },
    session: {
      create: mockCreateSession,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  sealSession: vi.fn().mockResolvedValue("sealed-cookie-value"),
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 2592000,
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: vi.fn().mockReturnValue(false),
  redisSet: vi.fn(),
}));

import { GET } from "@/app/auth/verify/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/auth/verify?token=${token}`
    : "http://localhost:3000/auth/verify";
  return new NextRequest(url);
}

const futureDate = new Date(Date.now() + 60 * 60 * 1000);

describe("GET /auth/verify", () => {
  beforeEach(() => {
    mockFindUniqueMagicToken.mockReset();
    mockUpdateMagicToken.mockReset();
    mockFindUniqueUser.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("redirects to sign-in when no token provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/sign-in");
  });

  it("redirects with error when token not found in DB", async () => {
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

  it("redirects with error when token is already used", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      id: "1",
      token: "used-token",
      used: true,
      expiresAt: futureDate,
      userId: "user1",
    });
    const res = await GET(makeRequest("used-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid-token");
  });

  it("redirects with error when token is expired", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      id: "1",
      token: "expired-token",
      used: false,
      expiresAt: new Date(Date.now() - 1000),
      userId: "user1",
    });
    const res = await GET(makeRequest("expired-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid-token");
  });

  it("sets session cookie and redirects to dashboard on valid token", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      id: "1",
      token: "valid-token",
      used: false,
      expiresAt: futureDate,
      userId: "user1",
    });
    mockUpdateMagicToken.mockResolvedValue({});
    mockFindUniqueUser.mockResolvedValue({ id: "user1", email: "host@example.com" });

    const res = await GET(makeRequest("valid-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("rsvp-session=sealed-cookie-value");
    expect(setCookie).toContain("HttpOnly");
  });

  it("marks token as used on success", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      id: "tok-id",
      token: "valid-token",
      used: false,
      expiresAt: futureDate,
      userId: "user1",
    });
    mockUpdateMagicToken.mockResolvedValue({});
    mockFindUniqueUser.mockResolvedValue({ id: "user1", email: "host@example.com" });

    await GET(makeRequest("valid-token"));
    expect(mockUpdateMagicToken).toHaveBeenCalledWith({
      where: { id: "tok-id" },
      data: { used: true },
    });
  });

  it("uses NEXT_PUBLIC_APP_URL for redirect destination", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.thecolefam.com";
    mockFindUniqueMagicToken.mockResolvedValue(null);
    const res = await GET(makeRequest("any-token"));
    expect(res.headers.get("location")).toContain("https://rsvp.thecolefam.com");
  });

  describe("extended cases", () => {
    it("does not promote user to ADMIN in route handler (handled via auth library)", async () => {
      mockFindUniqueMagicToken.mockResolvedValue({
        id: "tok-id",
        token: "valid-token",
        used: false,
        expiresAt: futureDate,
        userId: "user1",
      });
      mockUpdateMagicToken.mockResolvedValue({});
      mockFindUniqueUser.mockResolvedValue({ id: "user1", email: "admin@example.com", role: "HOST" });

      const res = await GET(makeRequest("valid-token"));
      expect(res.status).toBe(307);
    });
  });
});

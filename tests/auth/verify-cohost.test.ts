import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUniqueCoHostInvitation,
  mockDeleteCoHostInvitation,
  mockFindUniqueUser,
  mockCreateUser,
  mockUpdateUser,
  mockCreateEventCoHost,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockFindUniqueCoHostInvitation: vi.fn(),
  mockDeleteCoHostInvitation: vi.fn(),
  mockFindUniqueUser: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCreateEventCoHost: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    coHostInvitation: {
      findUnique: mockFindUniqueCoHostInvitation,
      delete: mockDeleteCoHostInvitation,
    },
    user: {
      findUnique: mockFindUniqueUser,
      create: mockCreateUser,
      update: mockUpdateUser,
    },
    eventCoHost: {
      create: mockCreateEventCoHost,
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

vi.mock("@/lib/auth", () => ({
  linkRsvpsToUser: vi.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/auth/verify-cohost/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/auth/verify-cohost?token=${token}`
    : "http://localhost:3000/auth/verify-cohost";
  return new NextRequest(url);
}

const futureDate = new Date(Date.now() + 60 * 60 * 1000);

describe("GET /auth/verify-cohost", () => {
  beforeEach(() => {
    mockFindUniqueCoHostInvitation.mockReset();
    mockDeleteCoHostInvitation.mockReset();
    mockFindUniqueUser.mockReset();
    mockCreateUser.mockReset();
    mockUpdateUser.mockReset();
    mockCreateEventCoHost.mockReset();
    mockCreateSession.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("redirects to sign-in when no token provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/sign-in");
  });

  it("redirects with error when token not found in DB", async () => {
    mockFindUniqueCoHostInvitation.mockResolvedValue(null);
    const res = await GET(makeRequest("bad-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid-token");
  });

  it("creates a new HOST user if they do not exist, accepts invite, and logs them in", async () => {
    mockFindUniqueCoHostInvitation.mockResolvedValue({
      id: "invite-1",
      eventId: "event-1",
      email: "newcohost@example.com",
      expiresAt: futureDate,
      event: { slug: "event-slug", title: "Party" },
    });
    mockFindUniqueUser.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({
      id: "user-new",
      email: "newcohost@example.com",
      role: "HOST",
    });
    mockCreateEventCoHost.mockResolvedValue({ id: "ch-1" });
    mockDeleteCoHostInvitation.mockResolvedValue({});

    const res = await GET(makeRequest("valid-token"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/e/event-slug/settings?activeSection=hosts"
    );
    expect(mockCreateUser).toHaveBeenCalledWith({
      data: {
        email: "newcohost@example.com",
        role: "HOST",
      },
    });
    expect(mockCreateEventCoHost).toHaveBeenCalledWith({
      data: {
        eventId: "event-1",
        userId: "user-new",
      },
    });
    expect(mockDeleteCoHostInvitation).toHaveBeenCalledWith({ where: { id: "invite-1" } });
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("rsvp-session=sealed-cookie-value");
  });

  it("upgrades user role to HOST if they exist as a GUEST", async () => {
    mockFindUniqueCoHostInvitation.mockResolvedValue({
      id: "invite-1",
      eventId: "event-1",
      email: "guest@example.com",
      expiresAt: futureDate,
      event: { slug: "event-slug", title: "Party" },
    });
    mockFindUniqueUser.mockResolvedValue({
      id: "user-guest",
      email: "guest@example.com",
      role: "GUEST",
    });
    mockUpdateUser.mockResolvedValue({
      id: "user-guest",
      email: "guest@example.com",
      role: "HOST",
    });
    mockCreateEventCoHost.mockResolvedValue({ id: "ch-1" });
    mockDeleteCoHostInvitation.mockResolvedValue({});

    const res = await GET(makeRequest("valid-token"));

    expect(res.status).toBe(307);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user-guest" },
      data: { role: "HOST" },
    });
  });
});

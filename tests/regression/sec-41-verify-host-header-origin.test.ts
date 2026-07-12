// SEC-41 — magic-link verify builds redirect origin from the Host header.
//
// Bug (found 2026-07, [cd6748] OWASP audit): app/auth/verify/route.ts derived
// the redirect `origin` from the request Host / x-forwarded-proto headers.
// Behind a proxy that does not pin Host, an attacker-controlled Host header
// poisons every redirect the route issues (sign-in errors and the post-login
// destination), a redirect/link-poisoning vector.
//
// Fix: prefer NEXT_PUBLIC_APP_URL as the canonical origin; the header
// derivation remains only as a fallback for installs that never set it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindUniqueMagicToken } = vi.hoisted(() => ({
  mockFindUniqueMagicToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    magicToken: { findUnique: mockFindUniqueMagicToken, update: vi.fn() },
    user: { findUnique: vi.fn() },
    session: { create: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  sealSession: vi.fn().mockResolvedValue("sealed-cookie-value"),
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 2592000,
}));
vi.mock("@/lib/auth", () => ({
  linkRsvpsToUser: vi.fn(),
  isSafeRedirect: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/redis", () => ({
  isRedisEnabled: vi.fn().mockReturnValue(false),
  redisSet: vi.fn(),
}));

import { GET } from "@/app/auth/verify/route";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  mockFindUniqueMagicToken.mockReset();
  mockFindUniqueMagicToken.mockResolvedValue(null); // invalid-token redirect path
});

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

function attackerRequest() {
  return new NextRequest("http://attacker.example.com/auth/verify?token=any-token", {
    headers: { host: "attacker.example.com", "x-forwarded-proto": "http" },
  });
}

describe("SEC-41: verify-route redirect origin", () => {
  it("ignores an attacker-controlled Host header when NEXT_PUBLIC_APP_URL is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.example.com/";
    const res = await GET(attackerRequest());
    expect(res.headers.get("location")).toBe(
      "https://rsvp.example.com/auth/sign-in?error=invalid-token"
    );
  });

  it("falls back to the Host header only when NEXT_PUBLIC_APP_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const res = await GET(attackerRequest());
    expect(res.headers.get("location")).toBe(
      "http://attacker.example.com/auth/sign-in?error=invalid-token"
    );
  });
});

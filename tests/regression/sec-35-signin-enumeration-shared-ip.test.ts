// SEC-35 — Host sign-in flow: account enumeration + shared-bucket self-DoS.
//
// Bugs (found 2026-07, STRIDE threat model of the auth/invite flows):
//
//   1. Information disclosure: sendMagicLinkAction returned `auth_failed` (which
//      the sign-in screen renders as a distinct "sign-in failed" state) when the
//      identifier had no account, but `success` when it did. The differential
//      let an attacker enumerate which emails/phones are registered. SEC-14a had
//      unified the error CODE but still branched success vs. failure on account
//      existence.
//
//   2. Denial of service: the per-IP limiter used getClientIp(), which collapses
//      to loopback ("127.0.0.1") whenever no TRUSTED_IP_HEADER is configured (the
//      default). That made `ip:127.0.0.1:magic-link` a single global bucket —
//      20 sign-in attempts anywhere locked out EVERY user for 10 minutes.
//
// Fix: return the same success response for unknown identifiers (send nothing),
// and only apply the per-IP limiter when a trusted proxy IP is configured,
// relying on the per-identifier limiter otherwise.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCreateMagicLink: vi.fn(),
  mockSendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
  mockSendMagicLinkSms: vi.fn().mockResolvedValue(undefined),
  mockRateLimit: vi.fn().mockResolvedValue({ success: true }),
  mockHeadersGet: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/auth", () => ({
  createMagicLink: mocks.mockCreateMagicLink,
  registerHost: vi.fn(),
  isOpenRegistrationActive: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: mocks.mockSendMagicLinkEmail }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: mocks.mockSendMagicLinkSms }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mocks.mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: mocks.mockHeadersGet }),
}));

import { sendMagicLinkAction } from "@/app/actions/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRateLimit.mockResolvedValue({ success: true });
  delete process.env.TRUSTED_IP_HEADER;
});

afterEach(() => {
  delete process.env.TRUSTED_IP_HEADER;
});

describe("SEC-35: no account enumeration on sign-in", () => {
  it("returns the same success response for an unknown identifier and sends nothing", async () => {
    mocks.mockCreateMagicLink.mockResolvedValue(null); // no user

    const unknown = await sendMagicLinkAction("nobody@example.com");

    expect(unknown).toEqual({ success: true });
    expect(mocks.mockSendMagicLinkEmail).not.toHaveBeenCalled();
    expect(mocks.mockSendMagicLinkSms).not.toHaveBeenCalled();
  });

  it("is indistinguishable from a real send to a registered identifier", async () => {
    mocks.mockCreateMagicLink.mockResolvedValueOnce(null); // unknown
    const unknown = await sendMagicLinkAction("nobody@example.com");

    mocks.mockCreateMagicLink.mockResolvedValueOnce("http://localhost:3000/auth/verify?token=abc"); // known
    const known = await sendMagicLinkAction("host@example.com");

    // The client cannot tell the two apart: identical response shape.
    expect(unknown).toEqual(known);
    expect(unknown).toEqual({ success: true });
  });
});

describe("SEC-35: no shared-bucket sign-in lockout", () => {
  it("does not consult a global loopback IP bucket when no trusted proxy is configured", async () => {
    mocks.mockCreateMagicLink.mockResolvedValue("http://localhost:3000/auth/verify?token=abc");

    await sendMagicLinkAction("user@example.com");

    // The shared ip:127.0.0.1:magic-link key must never be used — only the
    // per-identifier limiter runs in this mode.
    expect(mocks.mockRateLimit).not.toHaveBeenCalledWith("ip:127.0.0.1:magic-link", 20, 600);
    expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:user@example.com:magic-link", 5, 600);
  });

  it("restores per-client IP limiting when a trusted proxy IP is configured", async () => {
    process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
    mocks.mockHeadersGet.mockImplementation((h: string) =>
      h === "x-forwarded-for" ? "203.0.113.7" : null
    );
    mocks.mockCreateMagicLink.mockResolvedValue("http://localhost:3000/auth/verify?token=abc");

    await sendMagicLinkAction("user@example.com");

    expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:203.0.113.7:magic-link", 20, 600);
  });
});

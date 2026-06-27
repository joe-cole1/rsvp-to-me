// SEC-19 — No rate limiting on event-password verification.
//
// Bug (found 2026-06, security review): `verifyEventPassword` in
// app/actions/event.ts compared the submitted password with no attempt
// cap/lockout. bcrypt (cost 10) slows each guess but cannot stop sustained
// online brute-force of a weak password. The `rateLimit()` helper existed but
// was only wired into magic-link/register.
//
// Fix: gate `verifyEventPassword` behind `rateLimit("event-pw:<slug>:<ip>")`.
// When the limit is exceeded the action must short-circuit BEFORE touching the
// database or comparing the password.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRateLimit, mockGetClientIp, mockEventFindUnique } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockEventFindUnique: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: mockGetClientIp }));
vi.mock("@/lib/db", () => ({
  db: { event: { findUnique: mockEventFindUnique } },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendBlastEmail: vi.fn(),
  sendEventInviteEmail: vi.fn(),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendSmsBlast: vi.fn(),
  sendApprovalSms: vi.fn(),
  sendEventInviteSms: vi.fn(),
}));

import { verifyEventPassword } from "@/app/actions/event";

describe("SEC-19: event-password verification rate limiting", () => {
  beforeEach(() => {
    mockRateLimit.mockReset();
    mockGetClientIp.mockReset();
    mockEventFindUnique.mockReset();
    mockGetClientIp.mockResolvedValue("203.0.113.7");
  });

  it("blocks once the rate limit is exceeded, without checking the password", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: new Date(),
    });

    const result = await verifyEventPassword("secret-party", "guess");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many attempts/i);
    // Must short-circuit before any DB lookup / bcrypt comparison.
    expect(mockEventFindUnique).not.toHaveBeenCalled();
    // Rate limit key is scoped per slug + IP.
    expect(mockRateLimit).toHaveBeenCalledWith("event-pw:secret-party:203.0.113.7", 10, 600);
  });

  it("proceeds to verify the password when under the limit", async () => {
    mockRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: new Date() });
    mockEventFindUnique.mockResolvedValue({ passwordHash: null });

    const result = await verifyEventPassword("secret-party", "guess");

    // No password set → "Incorrect password", but crucially the DB was reached.
    expect(mockEventFindUnique).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/incorrect password/i);
  });
});

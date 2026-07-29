import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getClientIp: vi.fn(),
  isTrustedIpConfigured: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/clientIp", () => ({
  getClientIp: mocks.getClientIp,
  isTrustedIpConfigured: mocks.isTrustedIpConfigured,
}));

import { assertCaptcha, CaptchaVerificationError, getCaptchaSiteKey } from "@/lib/captcha";

const originalEnv = {
  siteKey: process.env.TURNSTILE_SITE_KEY,
  secretKey: process.env.TURNSTILE_SECRET_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

function enableCaptcha() {
  process.env.TURNSTILE_SITE_KEY = "site-key";
  process.env.TURNSTILE_SECRET_KEY = "secret-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.example.com";
}

function siteverifyResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      success: true,
      hostname: "rsvp.example.com",
      action: "comment",
      "error-codes": [],
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.example.com";
  mocks.getSession.mockResolvedValue({
    userId: "host-1",
    email: "host@example.com",
    role: "HOST",
  });
  mocks.isTrustedIpConfigured.mockReturnValue(false);
  mocks.getClientIp.mockResolvedValue("203.0.113.10");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalEnv.siteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
  else process.env.TURNSTILE_SITE_KEY = originalEnv.siteKey;
  if (originalEnv.secretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalEnv.secretKey;
  if (originalEnv.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalEnv.appUrl;
});

describe("Turnstile verification", () => {
  it("is disabled only when both keys are absent", async () => {
    expect(getCaptchaSiteKey()).toBeNull();
    await expect(assertCaptcha("comment", undefined)).resolves.toBeUndefined();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects partial configuration for non-admin users", async () => {
    process.env.TURNSTILE_SITE_KEY = "site-key";

    await expect(assertCaptcha("comment", undefined)).rejects.toBeInstanceOf(
      CaptchaVerificationError
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("lets an authenticated admin bypass configured verification", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    mocks.getSession.mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
    });

    await expect(assertCaptcha("comment", undefined)).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("validates an explicit action-bound token", async () => {
    enableCaptcha();
    vi.mocked(global.fetch).mockResolvedValue(siteverifyResponse() as unknown as Response);

    await expect(assertCaptcha("comment", "valid-token")).resolves.toBeUndefined();

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const body = init?.body as FormData;
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("valid-token");
    expect(body.get("remoteip")).toBeNull();
  });

  it("passes a client IP only when a trusted proxy header is configured", async () => {
    enableCaptcha();
    mocks.isTrustedIpConfigured.mockReturnValue(true);
    vi.mocked(global.fetch).mockResolvedValue(siteverifyResponse() as unknown as Response);

    await assertCaptcha("comment", "valid-token");

    const body = vi.mocked(global.fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("rejects missing, cross-action, and wrong-hostname tokens", async () => {
    enableCaptcha();
    await expect(assertCaptcha("comment", undefined)).rejects.toBeInstanceOf(
      CaptchaVerificationError
    );

    vi.mocked(global.fetch).mockResolvedValueOnce(
      siteverifyResponse({ action: "rsvp_create" }) as unknown as Response
    );
    await expect(assertCaptcha("comment", "valid-token")).rejects.toBeInstanceOf(
      CaptchaVerificationError
    );

    vi.mocked(global.fetch).mockResolvedValueOnce(
      siteverifyResponse({ hostname: "attacker.example" }) as unknown as Response
    );
    await expect(assertCaptcha("comment", "valid-token")).rejects.toBeInstanceOf(
      CaptchaVerificationError
    );
  });

  it("retries Siteverify once with the same idempotency key", async () => {
    enableCaptcha();
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(siteverifyResponse() as unknown as Response);

    await expect(assertCaptcha("comment", "valid-token")).resolves.toBeUndefined();

    const first = vi.mocked(global.fetch).mock.calls[0][1]?.body as FormData;
    const second = vi.mocked(global.fetch).mock.calls[1][1]?.body as FormData;
    expect(second.get("idempotency_key")).toBe(first.get("idempotency_key"));
  });
});

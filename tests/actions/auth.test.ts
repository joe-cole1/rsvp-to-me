import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the request-locale boundary; translation rendering remains the real English ICU catalog.
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return { ...actual, getRequestTranslator: () => actual.getTranslator("en-US") };
});

const mocks = vi.hoisted(() => ({
  mockCreateLoginChallenge: vi.fn(),
  mockVerifySignInCode: vi.fn(),
  mockRegisterHost: vi.fn(),
  mockIsOpenRegistrationActive: vi.fn().mockResolvedValue(false),
  mockSendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
  mockSendMagicLinkSms: vi.fn().mockResolvedValue(undefined),
  mockRateLimit: vi.fn().mockResolvedValue({ success: true }),
  mockCookieGet: vi.fn(),
  mockRecipient: vi.fn().mockResolvedValue({ preferredLocale: null }),
  mockHeadersGet: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.mockRecipient } } }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  createLoginChallenge: mocks.mockCreateLoginChallenge,
  verifySignInCode: mocks.mockVerifySignInCode,
  registerHost: mocks.mockRegisterHost,
  isOpenRegistrationActive: mocks.mockIsOpenRegistrationActive,
}));

vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: mocks.mockSendMagicLinkEmail,
}));

vi.mock("@/lib/sms", () => ({
  sendMagicLinkSms: mocks.mockSendMagicLinkSms,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: mocks.mockRateLimit,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mocks.mockCookieGet }),
  headers: vi.fn().mockResolvedValue({
    get: mocks.mockHeadersGet,
  }),
}));

import {
  sendMagicLinkAction,
  registerHostAction,
  verifySignInCodeAction,
} from "@/app/actions/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockHeadersGet.mockReset().mockReturnValue("127.0.0.1");
  mocks.mockRateLimit.mockResolvedValue({ success: true });
  // SEC-45: the per-IP sign-in limiter only runs when a trusted proxy IP is
  // configured. Default it on here so the two-tier (IP then identifier) tests
  // below exercise both limiters; individual tests override as needed.
  process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
});

describe("sendMagicLinkAction", () => {
  it("returns error when identifier is too short (< 3 chars)", async () => {
    const result = await sendMagicLinkAction("ab");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid email or phone number format");
  });

  it("returns error when IP rate limit is exceeded", async () => {
    mocks.mockRateLimit.mockResolvedValueOnce({ success: false }); // IP rate limit fails

    const result = await sendMagicLinkAction("test@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many sign-in requests from this IP");
  });

  it("returns error when identifier rate limit is exceeded", async () => {
    mocks.mockRateLimit
      .mockResolvedValueOnce({ success: true }) // IP rate limit passes
      .mockResolvedValueOnce({ success: false }); // ID rate limit fails

    const result = await sendMagicLinkAction("test@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many sign-in requests for this email/phone");
  });

  it("skips the shared per-IP limiter when no trusted proxy is configured (SEC-45)", async () => {
    // Without TRUSTED_IP_HEADER, getClientIp() collapses to loopback, so an
    // IP-keyed limiter would be one global bucket that self-DoSes all sign-ins.
    // The action must fall through to the identifier limiter only.
    delete process.env.TRUSTED_IP_HEADER;
    mocks.mockCreateLoginChallenge.mockResolvedValue({
      link: "http://localhost:3000/auth/verify?token=abc",
      code: "012345",
    });

    const result = await sendMagicLinkAction("user@example.com");

    expect(result.success).toBe(true);
    // Only the identifier limiter is consulted — no ip:*:magic-link key.
    expect(mocks.mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:user@example.com:magic-link", 5, 600);
  });

  it("returns success and sends nothing when user is not found (no enumeration, SEC-40)", async () => {
    mocks.mockCreateLoginChallenge.mockResolvedValue(null);

    const result = await sendMagicLinkAction("notfound@example.com");
    // Same response as a real send — must NOT reveal the account is absent.
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mocks.mockSendMagicLinkEmail).not.toHaveBeenCalled();
    expect(mocks.mockSendMagicLinkSms).not.toHaveBeenCalled();
  });

  it("returns auth_failed when email delivery throws an error", async () => {
    mocks.mockCreateLoginChallenge.mockResolvedValue({
      link: "http://localhost:3000/auth/verify?token=abc",
      code: "012345",
    });
    mocks.mockSendMagicLinkEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const result = await sendMagicLinkAction("user@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toBe("auth_failed");
  });

  it("sends email and returns success:true when user is found regardless of redirect", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc&redirect=%2Fe%2Fpanton-wine-night";
    mocks.mockCreateLoginChallenge.mockResolvedValue({ link, code: "012345" });

    const result = await sendMagicLinkAction("host@example.com", "/e/panton-wine-night");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "host@example.com",
      link,
      "en-US",
      "012345"
    );
  });

  it("calls sendMagicLinkEmail when input is an email and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateLoginChallenge.mockResolvedValue({ link, code: "012345" });

    const result = await sendMagicLinkAction("user@example.com");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "user@example.com",
      link,
      "en-US",
      "012345"
    );
  });

  it("calls sendMagicLinkSms with normalized phone when input is a phone and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateLoginChallenge.mockResolvedValue({ link, code: "012345" });

    const result = await sendMagicLinkAction("+1 (555) 123-4567");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkSms).toHaveBeenCalledWith(
      "+15551234567",
      link,
      "en-US",
      "012345"
    );
  });
});

describe("registerHostAction", () => {
  it("returns error for invalid email format", async () => {
    const result = await registerHostAction("invalid-email", "Joe", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid registration fields");
  });

  it("returns error when name is empty", async () => {
    const result = await registerHostAction("joe@example.com", "", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid registration fields");
  });

  it("returns error when IP rate limit is exceeded", async () => {
    mocks.mockRateLimit.mockResolvedValue({ success: false });

    const result = await registerHostAction("joe@example.com", "Joe", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many registration attempts");
  });
  it("delegates to registerHost with parsed email, name, inviteCode on success", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(false);
    mocks.mockRegisterHost.mockResolvedValue({ success: true });

    const result = await registerHostAction("joe@example.com", "Joe", "code123");
    expect(result.success).toBe(true);
    expect(mocks.mockRegisterHost).toHaveBeenCalledWith("joe@example.com", "Joe", "code123");
  });

  it("fails when open registration is disabled and inviteCode is empty", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(false);

    const result = await registerHostAction("joe@example.com", "Joe", "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invite code is required");
    expect(mocks.mockRegisterHost).not.toHaveBeenCalled();
  });

  it("succeeds when open registration is enabled and inviteCode is empty", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(true);
    mocks.mockRegisterHost.mockResolvedValue({ success: true });

    const result = await registerHostAction("joe@example.com", "Joe", "");
    expect(result.success).toBe(true);
    expect(mocks.mockRegisterHost).toHaveBeenCalledWith("joe@example.com", "Joe", "");
  });

  describe("getClientIp headers priority", () => {
    beforeEach(() => {
      delete process.env.TRUSTED_IP_HEADER;
    });

    it("uses TRUSTED_IP_HEADER if set", async () => {
      process.env.TRUSTED_IP_HEADER = "x-my-custom-ip";
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "x-my-custom-ip") return "9.9.9.9";
        return "127.0.0.1";
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:9.9.9.9:magic-link", 20, 600);
    });

    it("skips the per-IP limiter entirely when only spoofable headers are present (SEC-22 + SEC-45)", async () => {
      // Spoofable forwarding headers must NOT be trusted by default. Rather than
      // collapse to a single shared loopback bucket (which self-DoSes all
      // sign-ins), SEC-45 skips the per-IP limiter outright when no
      // TRUSTED_IP_HEADER is set — only the identifier limiter runs.
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "cf-connecting-ip") return "8.8.8.8";
        if (h === "x-real-ip") return "7.7.7.7";
        if (h === "x-forwarded-for") return "5.5.5.5, 4.4.4.4";
        return null;
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).not.toHaveBeenCalledWith("ip:127.0.0.1:magic-link", 20, 600);
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:test@example.com:magic-link", 5, 600);
    });

    it("uses the LAST hop of a trusted X-Forwarded-For chain (SEC-22)", async () => {
      // With a trusted proxy configured, the real client IP is the entry the
      // proxy appended (last), not the client-controlled first entry.
      process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "x-forwarded-for") return "5.5.5.5, 4.4.4.4";
        return null;
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:4.4.4.4:magic-link", 20, 600);
    });
  });
});

describe("magic-link recipient language", () => {
  beforeEach(() => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: null });
    mocks.mockCookieGet.mockReturnValue(undefined);
    mocks.mockCreateLoginChallenge.mockResolvedValue({
      link: "http://localhost:3000/auth/verify?token=language",
      code: "012345",
    });
  });
  it("uses saved recipient preference ahead of requesting browser", async () => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: "nl-NL" });
    mocks.mockCookieGet.mockReturnValue({ value: "en-US" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "nl-NL",
      "012345"
    );
  });
  it("uses browser cookie for an unset recipient without persisting it", async () => {
    mocks.mockCookieGet.mockReturnValue({ value: "nl-NL" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "nl-NL",
      "012345"
    );
    expect(mocks.mockRecipient).toHaveBeenCalledWith({
      where: { email: "known@example.com" },
      select: { preferredLocale: true },
    });
  });
  it("uses English for corrupt saved preference rather than requesting browser", async () => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: "invalid" });
    mocks.mockCookieGet.mockReturnValue({ value: "nl-NL" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "en-US",
      "012345"
    );
  });
});

it("registration delivers the paired code and link to the normalized email", async () => {
  mocks.mockIsOpenRegistrationActive.mockResolvedValue(true);
  mocks.mockRegisterHost.mockResolvedValue({ success: true });
  mocks.mockCreateLoginChallenge.mockResolvedValue({
    link: "https://example.test/auth/verify?token=fixture",
    code: "012345",
  });
  mocks.mockRecipient.mockResolvedValue({ preferredLocale: "nl-NL" });
  expect(await registerHostAction(" HOST@example.com ", "Host", "")).toEqual({ success: true });
  expect(mocks.mockCreateLoginChallenge).toHaveBeenCalledWith("host@example.com");
  expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
    "host@example.com",
    "https://example.test/auth/verify?token=fixture",
    "nl-NL",
    "012345"
  );
});

describe("verifySignInCodeAction", () => {
  it("normalizes identifiers and returns a safe destination", async () => {
    mocks.mockVerifySignInCode.mockResolvedValue(true);
    expect(await verifySignInCodeAction(" USER@example.com ", "012345", "/e/event")).toEqual({
      success: true,
      redirectTo: "/e/event",
    });
    expect(mocks.mockVerifySignInCode).toHaveBeenCalledWith("user@example.com", "012345");
    expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:user@example.com:signin-code", 10, 600);
    expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:127.0.0.1:signin-code", 20, 600);
  });
  it.each([undefined, "https://evil.test", "//evil.test", "/\\evil.test"])(
    "defaults unsafe/missing redirect %s to dashboard",
    async (redirect) => {
      mocks.mockVerifySignInCode.mockResolvedValue(true);
      expect(await verifySignInCodeAction("user@example.com", "012345", redirect)).toEqual({
        success: true,
        redirectTo: "/dashboard",
      });
    }
  );
  it("rejects invalid formats without attempting verification", async () => {
    expect((await verifySignInCodeAction("user@example.com", "12345")).success).toBe(false);
    expect(mocks.mockVerifySignInCode).not.toHaveBeenCalled();
  });
  it("rejects throttled attempts without attempting verification", async () => {
    mocks.mockRateLimit.mockResolvedValueOnce({ success: false });
    expect((await verifySignInCodeAction("user@example.com", "012345")).success).toBe(false);
    expect(mocks.mockVerifySignInCode).not.toHaveBeenCalled();
  });
});

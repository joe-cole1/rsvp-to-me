import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCreateMagicLink: vi.fn(),
  mockRegisterHost: vi.fn(),
  mockIsOpenRegistrationActive: vi.fn().mockResolvedValue(false),
  mockSendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
  mockSendMagicLinkSms: vi.fn().mockResolvedValue(undefined),
  mockRateLimit: vi.fn().mockResolvedValue({ success: true }),
  mockHeadersGet: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/auth", () => ({
  createMagicLink: mocks.mockCreateMagicLink,
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
  headers: vi.fn().mockResolvedValue({
    get: mocks.mockHeadersGet,
  }),
}));

import { sendMagicLinkAction, registerHostAction } from "@/app/actions/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRateLimit.mockResolvedValue({ success: true });
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

  it("returns success:true when user not found (createMagicLink returns null) — anti-enumeration", async () => {
    mocks.mockCreateMagicLink.mockResolvedValue(null);

    const result = await sendMagicLinkAction("notfound@example.com");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("calls sendMagicLinkEmail when input is an email and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateMagicLink.mockResolvedValue(link);

    const result = await sendMagicLinkAction("user@example.com");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith("user@example.com", link);
  });

  it("calls sendMagicLinkSms with normalized phone when input is a phone and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateMagicLink.mockResolvedValue(link);

    const result = await sendMagicLinkAction("+1 (555) 123-4567");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkSms).toHaveBeenCalledWith("+15551234567", link);
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
});

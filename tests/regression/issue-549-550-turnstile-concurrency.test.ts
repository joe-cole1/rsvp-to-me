/**
 * Root cause (found 2026-07): Turnstile responses were copied into one shared
 * browser cookie, so overlapping protected actions could overwrite or consume
 * each other's single-use, action-bound token before Siteverify received it.
 */
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

import { assertCaptcha } from "@/lib/captcha";

const originalEnv = {
  siteKey: process.env.TURNSTILE_SITE_KEY,
  secretKey: process.env.TURNSTILE_SECRET_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

beforeEach(() => {
  process.env.TURNSTILE_SITE_KEY = "site-key";
  process.env.TURNSTILE_SECRET_KEY = "secret-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://rsvp.example.com";
  mocks.getSession.mockResolvedValue({
    userId: "host-1",
    email: "host@example.com",
    role: "HOST",
  });
  mocks.getClientIp.mockResolvedValue("203.0.113.10");
  mocks.isTrustedIpConfigured.mockReturnValue(false);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as FormData;
      const action = body.get("response") === "comment-token" ? "comment" : "image_upload";

      return {
        ok: true,
        json: async () => ({
          success: true,
          hostname: "rsvp.example.com",
          action,
          "error-codes": [],
        }),
      } as Response;
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  if (originalEnv.siteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
  else process.env.TURNSTILE_SITE_KEY = originalEnv.siteKey;
  if (originalEnv.secretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalEnv.secretKey;
  if (originalEnv.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalEnv.appUrl;
});

describe("issues #549 and #550: concurrent Turnstile verification", () => {
  it("keeps each action's explicit token attached to its own request", async () => {
    await Promise.all([
      assertCaptcha("comment", "comment-token"),
      assertCaptcha("image_upload", "upload-token"),
    ]);

    const submittedTokens = vi
      .mocked(global.fetch)
      .mock.calls.map(([, init]) => (init?.body as FormData).get("response"));

    expect(submittedTokens).toEqual(["comment-token", "upload-token"]);
  });
});

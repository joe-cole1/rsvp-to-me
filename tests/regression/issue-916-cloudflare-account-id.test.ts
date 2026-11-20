// #916 / CodeQL js/request-forgery alert #10 — Cloudflare account ID in the API path.
//
// Root cause (found 2026-11): the admin test-email path interpolated the
// administrator-supplied Cloudflare account ID into the REST API URL without
// encoding or validation, then checked only that the finished URL was a public
// HTTPS address. An ID such as `x/../../zones?` still produced a valid
// api.cloudflare.com URL with a different path. The delivery paths encoded the
// ID but still accepted any value.
//
// Fix: one helper builds every `cloudflare_api` URL and accepts only
// Cloudflare's 32-hexadecimal-character account IDs; anything else makes the
// transport unavailable and the test send fails before any request.

import { beforeEach, describe, expect, it, vi } from "vitest";

const config: Record<string, string> = {};
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findMany: async () => Object.entries(config).map(([key, value]) => ({ key, value })),
      findUnique: async () => null,
    },
  },
}));

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async () => ({
  ok: true,
  json: async () => ({ success: true, result: {} }),
  text: async () => "OK",
}));
vi.stubGlobal("fetch", fetchMock);

const ACCOUNT_ID = "0123456789abcdef0123456789ABCDEF";
const PATH_ALTERING = [
  "../../zones",
  "0123456789abcdef0123456789abcdef/../../zones",
  "0123456789abcdef0123456789abcdef?x=1",
  "0123456789abcdef0123456789abcdef#frag",
  "0123456789abcdef0123456789abcdef%2F..",
  "0123456789abcdef0123456789abcde", // 31 characters
  "0123456789abcdef0123456789abcdefa", // 33 characters
  "0123456789abcdef0123456789abcdeg", // not hexadecimal
  "",
];

const testConfig = (accountId: string) => ({
  provider: "cloudflare_api",
  from: "noreply@example.com",
  smtp: { port: 587, secure: false },
  cloudflare: { accountId, apiToken: "fixture-api-token" },
});

describe("#916 Cloudflare account ID validation", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockClear();
    for (const key of Object.keys(config)) delete config[key];
  });

  it("builds the fixed send endpoint for a Cloudflare account ID", async () => {
    const { cloudflareApiSendUrl } = await import("@/lib/email");
    expect(cloudflareApiSendUrl(` ${ACCOUNT_ID} `)).toBe(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/email/sending/send"
    );
  });

  it.each(PATH_ALTERING)("rejects %j before building a URL", async (accountId) => {
    const { cloudflareApiSendUrl } = await import("@/lib/email");
    expect(cloudflareApiSendUrl(accountId)).toBeNull();
  });

  it("fails the admin test send without a request for path-altering IDs", async () => {
    const { testEmailConfig } = await import("@/lib/email");
    for (const accountId of PATH_ALTERING.filter(Boolean)) {
      const result = await testEmailConfig("admin@example.com", testConfig(accountId));
      expect(result.success, accountId).toBe(false);
      expect(result.error, accountId).toMatch(/Cloudflare Account ID/);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    expect((await testEmailConfig("admin@example.com", testConfig(ACCOUNT_ID))).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(
      "/client/v4/accounts/0123456789abcdef0123456789abcdef/email/sending/send"
    );
  });

  it("treats a saved path-altering ID as no REST API transport", async () => {
    Object.assign(config, {
      email_provider: "cloudflare_api",
      cloudflare_account_id: "x/../../zones",
      cloudflare_api_token: "fixture-api-token",
    });
    const { createEmailNotificationAdapter } = await import("@/lib/email");
    expect((await createEmailNotificationAdapter({ hostAlerts: true })).available).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

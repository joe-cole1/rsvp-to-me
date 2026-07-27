import { describe, expect, it } from "vitest";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export const CLOUDFLARE_TEST_KEYS = {
  SITEKEYS: {
    VISIBLE_PASS: "1x00000000000000000000AA",
    VISIBLE_FAIL: "2x00000000000000000000AB",
    INVISIBLE_PASS: "1x00000000000000000000BB",
    INVISIBLE_FAIL: "2x00000000000000000000BB",
    INTERACTIVE: "3x00000000000000000000FF",
  },
  SECRETS: {
    ALWAYS_PASSES: "1x0000000000000000000000000000000AA",
    ALWAYS_FAILS: "2x0000000000000000000000000000000AA",
    TOKEN_SPENT: "3x0000000000000000000000000000000AA",
  },
};

async function callSiteverify(secretKey: string, responseToken: string) {
  const body = new FormData();
  body.set("secret", secretKey);
  body.set("response", responseToken);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body,
  });
  return (await res.json()) as {
    success: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
}

describe("Cloudflare Turnstile Siteverify Integration (Test Secret Keys)", () => {
  it("always passes validation with test secret key 1x...00AA", async () => {
    const result = await callSiteverify(CLOUDFLARE_TEST_KEYS.SECRETS.ALWAYS_PASSES, DUMMY_TOKEN);
    expect(result.success).toBe(true);
    expect(result.hostname).toBeDefined();
  });

  it("always fails validation with test secret key 2x...00AA", async () => {
    const result = await callSiteverify(CLOUDFLARE_TEST_KEYS.SECRETS.ALWAYS_FAILS, DUMMY_TOKEN);
    expect(result.success).toBe(false);
    expect(result["error-codes"]).toContain("invalid-input-response");
  });

  it("returns timeout-or-duplicate with test secret key 3x...00AA", async () => {
    const result = await callSiteverify(CLOUDFLARE_TEST_KEYS.SECRETS.TOKEN_SPENT, DUMMY_TOKEN);
    expect(result.success).toBe(false);
    expect(result["error-codes"]).toContain("timeout-or-duplicate");
  });
});

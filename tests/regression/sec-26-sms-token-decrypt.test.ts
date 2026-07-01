// SEC-26 — DB-configured Twilio auth token was never decrypted.
//
// Bug (found 2026-07, security review): lib/sms.ts resolved the token with
//   const token = tokenEnc.startsWith("enc:") ? decryptConfig(tokenEnc) : tokenEnc;
// but encryptConfig() emits "iv:tag:cipher" (no "enc:" prefix), so a DB-stored
// (encrypted) Twilio auth token was passed to twilio(sid, token) as raw
// ciphertext and every admin-panel-configured SMS failed authentication.
// lib/email.ts already decrypted correctly via decryptConfig().
//
// M-5b (folded in): decryptConfig previously returned the raw ciphertext on a
// decryption failure, so an undecryptable value flowed onward as if it were a
// real credential. It now fails closed (returns "").
//
// Fix: a shared resolveTwilioAuthToken() that decrypts the stored value with
// decryptConfig() (no-op on plaintext, "" on failure), preferring DB config
// then the env var.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { systemConfig: { findUnique: mockFindUnique, findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/config", () => ({ isChannelEnabled: vi.fn().mockResolvedValue(true) }));

import { resolveTwilioAuthToken } from "@/lib/sms";
import { encryptConfig, decryptConfig } from "@/lib/crypto";

describe("SEC-26: Twilio auth token decryption", () => {
  const origEnv = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    mockFindUnique.mockReset();
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = origEnv;
  });

  it("decrypts an encrypted DB-stored token (the SEC-26 regression)", async () => {
    const real = "AC_secret_auth_token_1234567890";
    const encrypted = encryptConfig(real);
    // Pre-condition mirroring the bug: the stored value is NOT "enc:"-prefixed.
    expect(encrypted.startsWith("enc:")).toBe(false);

    // Via the configMap path (as resolveSmsConfig calls it).
    await expect(resolveTwilioAuthToken({ twilio_auth_token: encrypted })).resolves.toBe(real);

    // Via the DB path (as the webhook calls it).
    mockFindUnique.mockResolvedValue({ key: "twilio_auth_token", value: encrypted });
    await expect(resolveTwilioAuthToken()).resolves.toBe(real);
  });

  it("falls back to the env var when no DB value is set", async () => {
    process.env.TWILIO_AUTH_TOKEN = "env-token";
    mockFindUnique.mockResolvedValue(null);
    await expect(resolveTwilioAuthToken()).resolves.toBe("env-token");
    await expect(resolveTwilioAuthToken({})).resolves.toBe("env-token");
  });

  it("decryptConfig fails closed on an undecryptable value", () => {
    // A colon-shaped value that cannot be decrypted must yield "" (not the raw
    // ciphertext), so it can never be used as a live credential.
    expect(decryptConfig("abcdef:abcdef:abcdef")).toBe("");
  });
});

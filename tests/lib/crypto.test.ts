import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { encryptConfig, decryptConfig, getUnlockSignature } from "@/lib/crypto";

describe("encryptConfig", () => {
  it("returns empty string for empty input", () => {
    expect(encryptConfig("")).toBe("");
  });

  it("returns a string with three colon-separated parts", () => {
    const encrypted = encryptConfig("test-config");
    expect(encrypted).toContain(":");
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    // iv is 24 hex characters (12 bytes)
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    // authTag is 32 hex characters (16 bytes)
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces different ciphertext on repeated calls (random IV)", () => {
    const c1 = encryptConfig("secret");
    const c2 = encryptConfig("secret");
    expect(c1).not.toBe(c2);
  });
});

describe("decryptConfig", () => {
  it("returns empty string for empty input", () => {
    expect(decryptConfig("")).toBe("");
  });

  it("roundtrip: decryptConfig(encryptConfig(text)) === text for ascii text", () => {
    const text = "my-secret-key-12345";
    const encrypted = encryptConfig(text);
    const decrypted = decryptConfig(encrypted);
    expect(decrypted).toBe(text);
  });

  it("roundtrip: decryptConfig(encryptConfig(text)) === text for unicode text", () => {
    const text = "party 🎉 at Joe's house 🏠";
    const encrypted = encryptConfig(text);
    const decrypted = decryptConfig(encrypted);
    expect(decrypted).toBe(text);
  });

  it("returns the input unchanged when it has no colons (not encrypted)", () => {
    const plain = "plaintext";
    expect(decryptConfig(plain)).toBe(plain);
  });

  it("fails closed (returns empty string) on corrupt data, without throwing", () => {
    // SEC-26 / M-5b: an undecryptable value must NOT be echoed back as if it
    // were a usable credential — callers treat "" as "not configured".
    const corrupt = "abcdef:abcdef:abcdef";
    const result = decryptConfig(corrupt);
    expect(result).toBe("");
  });
});

describe("getUnlockSignature", () => {
  const origSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    process.env.SESSION_SECRET = origSecret;
  });

  it("returns a 64-char lowercase hex string", () => {
    const sig = getUnlockSignature("my-slug");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: same slug always returns same signature", () => {
    expect(getUnlockSignature("my-slug")).toBe(getUnlockSignature("my-slug"));
  });

  it("different slugs produce different signatures", () => {
    expect(getUnlockSignature("slug-1")).not.toBe(getUnlockSignature("slug-2"));
  });

  it("throws when SESSION_SECRET is not set", () => {
    delete process.env.SESSION_SECRET;
    expect(() => getUnlockSignature("my-slug")).toThrow(/SESSION_SECRET/);
  });
});

describe("encryptConfig / decryptConfig — property tests", () => {
  it("round-trips arbitrary non-empty strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (text) => {
        expect(decryptConfig(encryptConfig(text))).toBe(text);
      }),
      { numRuns: 20 }
    );
  });

  it("encrypted output always has three colon-separated parts", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (text) => {
        const parts = encryptConfig(text).split(":");
        expect(parts.length).toBe(3);
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
        expect(parts[2].length).toBeGreaterThan(0);
      })
    );
  });

  it("two encryptions of the same string differ (random IV)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (text) => {
        expect(encryptConfig(text)).not.toBe(encryptConfig(text));
      }),
      { numRuns: 20 }
    );
  });
});

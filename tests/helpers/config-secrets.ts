import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

export const TEST_CONFIG_KEY = "config-secrets-disposable-test-key-at-least-32-characters";

// Independent fixture for the format shipped before #328/#339.
export function legacyConfig(value: string, secret = TEST_CONFIG_KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "rsvp-to-me-salt", 32), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

export function readLegacyConfig(value: string): string {
  const [iv, tag, text] = value.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    scryptSync(TEST_CONFIG_KEY, "rsvp-to-me-salt", 32),
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(text, "hex")), decipher.final()]).toString(
    "utf8"
  );
}

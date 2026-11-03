import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const AAD = Buffer.from("rsvp-to-me:config:v2");
const V2_PATTERN = /^v2:([0-9a-f]{32}):([0-9a-f]{24}):([0-9a-f]{32}):((?:[0-9a-f]{2})+)$/;

export function getConfigEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Neither ENCRYPTION_KEY nor SESSION_SECRET is configured.");
  }
  return secret;
}

export function encryptConfig(text: string): string {
  if (!text) return "";
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(getConfigEncryptionSecret(), salt, 32);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `v2:${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// Migration needs to distinguish an invalid value from an empty setting.
export function decryptConfigStrict(encryptedData: string): string {
  if (!encryptedData) return "";

  try {
    const match = V2_PATTERN.exec(encryptedData);
    if (!match) throw new Error();
    const [, salt, ivHex, tagHex, encryptedText] = match;

    const key = scryptSync(getConfigEncryptionSecret(), Buffer.from(salt, "hex"), 32);
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    throw new Error("Invalid or undecryptable configuration credential.");
  }
}

export function decryptConfig(value: string): string {
  try {
    return decryptConfigStrict(value);
  } catch {
    // SEC-26 / #339: never return raw input or log credential/key values.
    console.error("[crypto] Invalid or undecryptable stored credential; treating as unconfigured.");
    return "";
  }
}

export function getUnlockSignature(slug: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(slug).digest("hex");
}

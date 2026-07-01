import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Neither ENCRYPTION_KEY nor SESSION_SECRET is configured.");
  }
  return scryptSync(secret, "rsvp-to-me-salt", 32);
}

export function encryptConfig(text: string): string {
  if (!text) return "";
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptConfig(encryptedData: string): string {
  if (!encryptedData) return "";
  if (!encryptedData.includes(":")) {
    return encryptedData;
  }

  try {
    const [ivHex, tagHex, encryptedText] = encryptedData.split(":");
    if (!ivHex || !tagHex || !encryptedText) {
      return encryptedData;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    // SEC-26 / M-5b: fail closed. Returning the raw ciphertext here previously
    // let an undecryptable value (wrong ENCRYPTION_KEY, corruption, tampering)
    // flow onward as if it were a real credential — e.g. the ciphertext being
    // handed to Twilio as a live auth token. Callers treat "" as "not
    // configured" (and fall back to env / console mode) instead.
    console.error("[crypto] Decryption failed, treating as unconfigured:", err);
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

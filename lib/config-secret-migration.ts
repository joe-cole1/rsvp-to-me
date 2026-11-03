// #328 / SEC-8 and #339 / SEC-44: legacy decoding exists only in this migration.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { decryptConfigStrict, encryptConfig, getConfigEncryptionSecret } from "./crypto";

export const CONFIG_SECRET_KEYS = [
  "smtp_pass",
  "cloudflare_worker_api_secret",
  "cloudflare_api_token",
  "twilio_auth_token",
] as const;
export const CONFIG_ENCRYPTION_MARKER = "config_encryption_version";
export type MigrationMode = "migrate" | "check" | "rollback";

export class ConfigSecretMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigSecretMigrationError";
  }
}

const LEGACY_PATTERN = /^([0-9a-f]{24}):([0-9a-f]{32}):((?:[0-9a-f]{2})+)$/;

function decodeLegacy(value: string): string {
  if (!value.includes(":")) return value;
  const match = LEGACY_PATTERN.exec(value);
  if (!match) throw new Error();
  const [, iv, tag, ciphertext] = match;
  const key = scryptSync(getConfigEncryptionSecret(), "rsvp-to-me-salt", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function encodeLegacy(value: string): string {
  const iv = randomBytes(12);
  const key = scryptSync(getConfigEncryptionSecret(), "rsvp-to-me-salt", 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

export async function migrateConfigSecrets(
  db: PrismaClient,
  mode: MigrationMode,
  beforeWrite: () => Promise<void>
) {
  return db.$transaction(
    async (tx) => {
      // Serialize replicas and block admin writes during check/backup/conversion.
      // Reads remain available; operators must stop all old app instances.
      await tx.$executeRaw`LOCK TABLE "SystemConfig" IN SHARE ROW EXCLUSIVE MODE`;
      const rows = await tx.systemConfig.findMany({
        where: { key: { in: [...CONFIG_SECRET_KEYS, CONFIG_ENCRYPTION_MARKER] } },
      });
      const marker = rows.find((row) => row.key === CONFIG_ENCRYPTION_MARKER);
      if (marker && marker.value !== "2") {
        throw new ConfigSecretMigrationError("Unsupported configuration encryption version.");
      }
      const changes: { key: string; value: string }[] = [];
      let verified = 0;
      for (const row of rows) {
        if (row.key === CONFIG_ENCRYPTION_MARKER || !row.value) continue;
        try {
          if (row.value.startsWith("v2:")) {
            const plain = decryptConfigStrict(row.value);
            if (mode === "rollback") changes.push({ key: row.key, value: encodeLegacy(plain) });
            else verified++;
          } else {
            if (marker) throw new Error();
            const plain = decodeLegacy(row.value);
            if (mode !== "rollback") changes.push({ key: row.key, value: encryptConfig(plain) });
          }
        } catch {
          throw new ConfigSecretMigrationError(
            `Cannot verify ${row.key}. Keep the original ENCRYPTION_KEY (or SESSION_SECRET fallback). If the key is correct, restore a valid credential from backup. Before first conversion, the setting can also be re-saved with the previous app version. No secret conversion was committed.`
          );
        }
      }
      if (mode !== "check") {
        // Authenticate/classify every value before backup or any database write.
        if (changes.length) await beforeWrite();
        for (const change of changes) {
          await tx.systemConfig.update({
            where: { key: change.key },
            data: { value: change.value },
          });
        }
        if (mode === "rollback") {
          await tx.systemConfig.deleteMany({ where: { key: CONFIG_ENCRYPTION_MARKER } });
        } else {
          await tx.systemConfig.upsert({
            where: { key: CONFIG_ENCRYPTION_MARKER },
            create: { key: CONFIG_ENCRYPTION_MARKER, value: "2" },
            update: { value: "2" },
          });
        }
      }
      return {
        mode,
        converted: changes.length,
        verified,
        complete: mode !== "rollback" && (mode !== "check" || !!marker),
      };
    },
    { maxWait: 30000, timeout: 120000 }
  );
}

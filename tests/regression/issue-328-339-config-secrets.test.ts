// #328 / SEC-8: every credential used the same scrypt salt.
// #339 / SEC-44: plaintext and malformed ciphertext could become live credentials.
// The fix uses authenticated v2 values and a migration-only legacy decoder;
// conversion is one-time, backed up, atomic, restart-safe, and reversible.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient, Prisma } from "@/app/generated/prisma/client";
import { createDecipheriv, scryptSync } from "crypto";
import { decryptConfig, decryptConfigStrict, encryptConfig } from "@/lib/crypto";
import {
  CONFIG_ENCRYPTION_MARKER,
  CONFIG_SECRET_KEYS,
  migrateConfigSecrets,
} from "@/lib/config-secret-migration";
import { legacyConfig, readLegacyConfig, TEST_CONFIG_KEY } from "../helpers/config-secrets";

function database(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    systemConfig: {
      findMany: vi.fn(async () =>
        [...values]
          .filter(([key]) => [...CONFIG_SECRET_KEYS, CONFIG_ENCRYPTION_MARKER].includes(key))
          .map(([key, value]) => ({ key, value }))
      ),
      update: vi.fn(
        async ({ where, data }: { where: { key: string }; data: { value: string } }) => {
          values.set(where.key, data.value);
        }
      ),
      upsert: vi.fn(
        async ({ where, create }: { where: { key: string }; create: { value: string } }) => {
          values.set(where.key, create.value);
        }
      ),
      deleteMany: vi.fn(async () => values.delete(CONFIG_ENCRYPTION_MARKER)),
    },
  };
  const client = {
    $transaction: vi.fn(
      async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) => {
        const snapshot = new Map(values);
        try {
          return await callback(tx as unknown as Prisma.TransactionClient);
        } catch (error) {
          values.clear();
          snapshot.forEach((value, key) => values.set(key, value));
          throw error;
        }
      }
    ),
  } as unknown as PrismaClient;
  return { client, tx, values };
}

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_CONFIG_KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("#328: independent salts and authenticated format", () => {
  it("derives the real key from each stored salt", () => {
    const first = encryptConfig("fixture-password");
    const second = encryptConfig("fixture-password");
    const [version, salt, iv, tag, ciphertext] = first.split(":");
    expect(version).toBe("v2");
    expect(salt).toHaveLength(32);
    expect(second.split(":")[1]).not.toBe(salt);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      scryptSync(TEST_CONFIG_KEY, Buffer.from(salt, "hex"), 32),
      Buffer.from(iv, "hex")
    );
    decipher.setAAD(Buffer.from("rsvp-to-me:config:v2"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    expect(
      Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString()
    ).toBe("fixture-password");
  });

  it.each([0, 1, 2, 3, 4])("rejects tampering with field %i", (index) => {
    const parts = encryptConfig("fixture-secret").split(":");
    parts[index] = (parts[index][0] === "0" ? "1" : "0") + parts[index].slice(1);
    expect(decryptConfig(parts.join(":"))).toBe("");
  });

  it("preserves SESSION_SECRET fallback and rejects a changed key", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("SESSION_SECRET", TEST_CONFIG_KEY);
    const encrypted = encryptConfig("fixture");
    expect(decryptConfig(encrypted)).toBe("fixture");
    vi.stubEnv("SESSION_SECRET", "different-disposable-session-key-for-tests");
    expect(decryptConfig(encrypted)).toBe("");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => encryptConfig("fixture")).toThrow(/configured/);
  });
});

describe("#339: runtime rejects unencrypted and malformed values", () => {
  it.each(["plaintext-fixture", "one:two", "one:two:three", "v3:unknown", "v2:bad", "::"])(
    "fails closed for %s",
    (value) => {
      expect(decryptConfig(value)).toBe("");
      expect(() => decryptConfigStrict(value)).toThrow("Invalid or undecryptable");
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(value);
    }
  );
  it("keeps legacy ciphertext out of normal application reads", () => {
    expect(decryptConfig(legacyConfig("fixture"))).toBe("");
    expect(decryptConfig(encryptConfig("fixture") + ":extra")).toBe("");
  });
});

describe("one-time secret migration", () => {
  it("converts only secret settings and leaves restarts unchanged", async () => {
    const { client, tx, values } = database({
      smtp_pass: legacyConfig("smtp-fixture"),
      twilio_auth_token: "twilio-fixture",
      cloudflare_api_token: "",
      email_from: "person@example.invalid",
    });
    const backup = vi.fn(async () => {
      expect(tx.systemConfig.update).not.toHaveBeenCalled();
    });
    expect(await migrateConfigSecrets(client, "migrate", backup)).toMatchObject({
      converted: 2,
      complete: true,
    });
    expect(backup).toHaveBeenCalledOnce();
    expect(decryptConfig(values.get("smtp_pass")!)).toBe("smtp-fixture");
    expect(decryptConfig(values.get("twilio_auth_token")!)).toBe("twilio-fixture");
    expect(values.get("cloudflare_api_token")).toBe("");
    expect(values.get("email_from")).toBe("person@example.invalid");
    const snapshot = new Map(values);
    expect(await migrateConfigSecrets(client, "migrate", backup)).toMatchObject({
      converted: 0,
      verified: 2,
    });
    expect(values).toEqual(snapshot);
    expect(backup).toHaveBeenCalledOnce();
  });

  it("makes check mode read-only, including the completion marker", async () => {
    const { client, values, tx } = database({ smtp_pass: "fixture" });
    const snapshot = new Map(values);
    const backup = vi.fn();
    expect(await migrateConfigSecrets(client, "check", backup)).toMatchObject({
      converted: 1,
      complete: false,
    });
    expect(values).toEqual(snapshot);
    expect(tx.systemConfig.update).not.toHaveBeenCalled();
    expect(backup).not.toHaveBeenCalled();
  });

  it("checks every setting before conversion and never logs raw input", async () => {
    const { client, tx } = database({
      smtp_pass: "valid-fixture",
      twilio_auth_token: "corrupt:fixture",
    });
    const backup = vi.fn();
    await expect(migrateConfigSecrets(client, "migrate", backup)).rejects.toThrow(
      "Cannot verify twilio_auth_token"
    );
    expect(tx.systemConfig.update).not.toHaveBeenCalled();
    expect(backup).not.toHaveBeenCalled();
  });

  it("rejects wrong encryption keys before any writes", async () => {
    const { client, tx } = database({ smtp_pass: legacyConfig("fixture", "old-disposable-key") });
    await expect(migrateConfigSecrets(client, "migrate", vi.fn())).rejects.toThrow(
      "Cannot verify smtp_pass"
    );
    expect(tx.systemConfig.update).not.toHaveBeenCalled();
  });

  it("aborts without writes when the required backup fails", async () => {
    const { client, tx, values } = database({ smtp_pass: "fixture" });
    await expect(
      migrateConfigSecrets(client, "migrate", async () => {
        throw new Error("backup failed");
      })
    ).rejects.toThrow("backup failed");
    expect(values.get("smtp_pass")).toBe("fixture");
    expect(tx.systemConfig.update).not.toHaveBeenCalled();
    expect(values.has(CONFIG_ENCRYPTION_MARKER)).toBe(false);
  });

  it("never converts newly introduced plaintext after completion", async () => {
    const { client } = database({ [CONFIG_ENCRYPTION_MARKER]: "2", smtp_pass: "fixture" });
    await expect(migrateConfigSecrets(client, "migrate", vi.fn())).rejects.toThrow(
      "Cannot verify smtp_pass"
    );
  });

  it("rejects unknown migration versions", async () => {
    const { client } = database({ [CONFIG_ENCRYPTION_MARKER]: "3" });
    await expect(migrateConfigSecrets(client, "migrate", vi.fn())).rejects.toThrow("Unsupported");
  });

  it("marks empty installations without a backup and can roll back only credentials", async () => {
    const { client, values } = database({ site_title: "Keep me" });
    const backup = vi.fn();
    await migrateConfigSecrets(client, "migrate", backup);
    expect(backup).not.toHaveBeenCalled();
    values.set("smtp_pass", encryptConfig("smtp-fixture"));
    await migrateConfigSecrets(client, "rollback", backup);
    expect(readLegacyConfig(values.get("smtp_pass")!)).toBe("smtp-fixture");
    expect(values.has(CONFIG_ENCRYPTION_MARKER)).toBe(false);
    expect(values.get("site_title")).toBe("Keep me");
    await migrateConfigSecrets(client, "migrate", backup);
    expect(decryptConfig(values.get("smtp_pass")!)).toBe("smtp-fixture");
  });
});

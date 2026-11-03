// #328/#339: exercise real PostgreSQL commit/rollback and concurrent startup,
// rather than treating a mocked transaction as proof of migration safety.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { db, truncateAll } from "../helpers/db";
import { decryptConfig } from "@/lib/crypto";
import { CONFIG_ENCRYPTION_MARKER, migrateConfigSecrets } from "@/lib/config-secret-migration";
import { legacyConfig, readLegacyConfig, TEST_CONFIG_KEY } from "../../helpers/config-secrets";

beforeEach(async () => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_CONFIG_KEY);
  await truncateAll();
});
afterEach(async () => {
  // Never leave a wrong-key fixture for later suites or the E2E startup.
  await truncateAll();
  vi.unstubAllEnvs();
});

async function setting(key: string) {
  return (await db.systemConfig.findUnique({ where: { key } }))?.value;
}

describe("configuration secret upgrade", () => {
  it("serializes competing startups, converts once, and preserves nonsecret settings", async () => {
    await db.systemConfig.createMany({
      data: [
        { key: "smtp_pass", value: legacyConfig("smtp-fixture") },
        { key: "twilio_auth_token", value: "twilio-fixture" },
        { key: "site_title", value: "Unchanged site" },
      ],
    });
    const backup = vi.fn(async () => {});
    const results = await Promise.all([
      migrateConfigSecrets(db, "migrate", backup),
      migrateConfigSecrets(db, "migrate", backup),
    ]);
    expect(results.map((result) => result.converted).sort()).toEqual([0, 2]);
    expect(backup).toHaveBeenCalledOnce();
    expect(decryptConfig((await setting("smtp_pass"))!)).toBe("smtp-fixture");
    expect(decryptConfig((await setting("twilio_auth_token"))!)).toBe("twilio-fixture");
    expect(await setting("site_title")).toBe("Unchanged site");
    expect(await setting(CONFIG_ENCRYPTION_MARKER)).toBe("2");
  });

  it("rolls back an earlier converted row when a later database write fails", async () => {
    const original = legacyConfig("smtp-fixture");
    await db.systemConfig.createMany({
      data: [
        { key: "smtp_pass", value: original },
        { key: "twilio_auth_token", value: "twilio-fixture" },
      ],
    });
    await db.$executeRaw`ALTER TABLE "SystemConfig" ADD CONSTRAINT config_secrets_test_failure CHECK (key <> 'twilio_auth_token' OR value NOT LIKE 'v2:%')`;
    try {
      await expect(migrateConfigSecrets(db, "migrate", async () => {})).rejects.toThrow();
      expect(await setting("smtp_pass")).toBe(original);
      expect(await setting("twilio_auth_token")).toBe("twilio-fixture");
      expect(await setting(CONFIG_ENCRYPTION_MARKER)).toBeUndefined();
    } finally {
      await db.$executeRaw`ALTER TABLE "SystemConfig" DROP CONSTRAINT config_secrets_test_failure`;
    }
  });

  it("supports a selective rollback and upgrade without reverting other data", async () => {
    await db.systemConfig.create({ data: { key: "smtp_pass", value: "smtp-fixture" } });
    await migrateConfigSecrets(db, "migrate", async () => {});
    await db.hostInviteCode.create({ data: { code: "received-after-upgrade" } });
    await migrateConfigSecrets(db, "rollback", async () => {});
    expect(readLegacyConfig((await setting("smtp_pass"))!)).toBe("smtp-fixture");
    expect(await setting(CONFIG_ENCRYPTION_MARKER)).toBeUndefined();
    expect(await db.hostInviteCode.count()).toBe(1);
    await migrateConfigSecrets(db, "migrate", async () => {});
    expect(decryptConfig((await setting("smtp_pass"))!)).toBe("smtp-fixture");
  });

  it("leaves data unchanged on dry-run and backup failure", async () => {
    await db.systemConfig.create({ data: { key: "smtp_pass", value: "smtp-fixture" } });
    await migrateConfigSecrets(db, "check", vi.fn());
    await expect(
      migrateConfigSecrets(db, "migrate", async () => {
        throw new Error("backup unavailable");
      })
    ).rejects.toThrow("backup unavailable");
    expect(await setting("smtp_pass")).toBe("smtp-fixture");
    expect(await setting(CONFIG_ENCRYPTION_MARKER)).toBeUndefined();
  });

  it("exits nonzero with an actionable redacted CLI error for a wrong key", async () => {
    const stored = legacyConfig("private-fixture-password");
    await db.systemConfig.create({ data: { key: "smtp_pass", value: stored } });
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/migrate-config-secrets.ts"],
      {
        env: { ...process.env, ENCRYPTION_KEY: "wrong-disposable-key-for-integration" },
        encoding: "utf8",
        timeout: 15000,
      }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[config-secrets] ERROR: Cannot verify smtp_pass");
    expect(result.stderr).toContain("Application startup is blocked");
    expect(result.stderr).not.toContain(stored);
    expect(result.stderr).not.toContain("private-fixture-password");
    expect(result.stderr).not.toContain("wrong-disposable-key-for-integration");
    expect(await setting("smtp_pass")).toBe(stored);
    expect(await setting(CONFIG_ENCRYPTION_MARKER)).toBeUndefined();
  });
});

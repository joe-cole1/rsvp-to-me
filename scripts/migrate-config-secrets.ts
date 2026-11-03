import "dotenv/config";
import { ConfigSecretMigrationError, migrateConfigSecrets } from "../lib/config-secret-migration";
import { runPreMigrationBackup } from "./migrate-db";

let disconnect: (() => Promise<void>) | undefined;

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !["--check", "--rollback"].includes(args[0]))) {
    throw new ConfigSecretMigrationError("Usage: npm run db:secrets -- [--check|--rollback]");
  }
  const mode = args[0] === "--check" ? "check" : args[0] === "--rollback" ? "rollback" : "migrate";
  const { db } = await import("../lib/db");
  disconnect = () => db.$disconnect();
  const summary = await migrateConfigSecrets(db, mode, async () => {
    if (!runPreMigrationBackup(process.env.DATABASE_URL || "")) {
      throw new ConfigSecretMigrationError(
        "Backup failed; no secret conversion was committed. Check backup storage and pg_dump availability, then retry."
      );
    }
  });
  console.log(
    `[config-secrets] ${mode}: ${summary.converted} ${mode === "check" ? "pending" : "converted"}, ${summary.verified} verified; ${summary.complete ? "v2 ready" : "legacy/pending"}.`
  );
}

main()
  .catch((error: unknown) => {
    const message =
      error instanceof ConfigSecretMigrationError
        ? error.message
        : "Migration could not be verified. Check database availability and retry; completed conversions are safe to verify again. Raw database errors are suppressed to protect credentials.";
    console.error(`[config-secrets] ERROR: ${message} Application startup is blocked.`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnect?.().catch(() => {
      console.error("[config-secrets] Database disconnect failed; connection details suppressed.");
      process.exitCode = 1;
    });
  });

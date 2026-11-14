/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("node:crypto");
const { snapshotDirectory, rotatePreMigrationBackups } = require("./pre-migration-backups.cjs");

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDbUrl(rawUrl) {
  const url = rawUrl
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port || "5432",
      user: parsed.username || "postgres",
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.slice(1) || "rsvp_db",
    };
  } catch {
    return null;
  }
}

function runPreMigrationBackup(rawUrl, purpose = "schema") {
  if (!["schema", "secrets"].includes(purpose)) throw new Error("Invalid backup purpose");
  const conn = parseDbUrl(rawUrl);
  if (!conn) {
    console.warn("[migrate-db] Could not parse DATABASE_URL — skipping pre-migration backup.");
    return;
  }

  let backupDir;
  try {
    backupDir = snapshotDirectory(true);
    fs.chmodSync(backupDir, 0o700);
  } catch {
    console.warn("[migrate-db] Could not create backup directory — skipping pre-migration backup.");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `pre-migration-${purpose}_${timestamp}_${randomUUID()}.sql`;
  const outputPath = path.join(backupDir, filename);

  const partialPath = `${outputPath}.partial`;

  console.log("[migrate-db] Running pre-migration backup to %s...", filename);
  let created = false;
  try {
    // A legacy snapshot may contain plaintext provider credentials. Reserve a
    // private file before pg_dump opens it; never overwrite an existing backup.
    fs.closeSync(fs.openSync(partialPath, "wx", 0o600));
    created = true;
    execFileSync(
      "pg_dump",
      ["-h", conn.host, "-p", conn.port, "-U", conn.user, "-f", partialPath, conn.database],
      {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 60000,
      }
    );
    fs.renameSync(partialPath, outputPath);
    // Retention failure must not turn a successful recovery snapshot into a
    // failed backup or allow an incomplete dump to replace a prior snapshot.
    try {
      rotatePreMigrationBackups(filename);
    } catch {
      console.warn(
        "[migrate-db] Backup saved, but retention failed; check backup storage permissions."
      );
    }
    console.log("[migrate-db] Pre-migration backup complete: %s", filename);
    return outputPath;
  } catch {
    // Schema startup keeps its best-effort backup policy. Secret conversion
    // checks the return value and aborts before writes if its backup fails.
    console.warn("[migrate-db] Pre-migration backup failed; check pg_dump and backup storage.");
    if (created && fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
  }
}

function isP3009Error(output) {
  // P3009: migrate found failed migrations in the target database
  return output.includes("P3009") || output.includes("failed migrations in the target database");
}

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      return; // success
    } catch (err) {
      const output =
        (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") + (err.message ?? "");

      if (isP3009Error(output)) {
        console.error("[migrate-db] A previous migration is stuck (P3009).");
        console.error("[migrate-db] Resolve it by running:");
        console.error("[migrate-db]   npx prisma migrate resolve --rolled-back <migration_name>");
        console.error("[migrate-db] Then restart the container.");
        process.exit(1);
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 5000;
        console.warn(
          "[migrate-db] Migration attempt %d/%d failed — retrying in %dms...",
          attempt,
          MAX_RETRIES,
          delay
        );
        await sleep(delay);
      } else {
        console.error("[migrate-db] All %d migration attempts failed.", MAX_RETRIES);
        console.error("[migrate-db] Last error:", err.message ?? err);
        process.exit(1);
      }
    }
  }
}

async function main() {
  const rawUrl = process.env.DATABASE_URL || "";
  const displayUrl = rawUrl ? rawUrl.split("@")[1] || rawUrl : "not set";
  console.log("[migrate-db] Active DATABASE_URL: %s", displayUrl);

  runPreMigrationBackup(rawUrl);

  console.log("[migrate-db] Deploying database migrations...");
  await runMigrations();
  console.log("[migrate-db] Database migrations deployed successfully.");
}

module.exports = { runPreMigrationBackup };
if (require.main === module) main();

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";

const execFileAsync = promisify(execFile);
const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}

export async function getBackupKeepCount(): Promise<number> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: "backup_keep_count" },
    });
    if (config?.value) {
      const parsed = parseInt(config.value, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {}

  const envVal = parseInt(process.env.BACKUP_KEEP_COUNT || "7", 10);
  return isNaN(envVal) || envVal <= 0 ? 7 : envVal;
}

export async function listBackups(): Promise<BackupFile[]> {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return [];
  }

  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    const backups: BackupFile[] = [];

    for (const file of files) {
      if (file.startsWith("backup_") && file.endsWith(".sql")) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        backups.push({
          filename: file,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
        });
      }
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    console.error("[backup] Failed to list backups:", err);
    return [];
  }
}

export async function runBackup(): Promise<string> {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const url = (process.env.DATABASE_URL ?? "").trim();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup_${timestamp}.sql`;
  const outputPath = path.join(BACKUPS_DIR, filename);

  console.log("[backup] Starting PostgreSQL backup to %s...", filename);

  let dbUrl: URL;
  try {
    dbUrl = new URL(url);
  } catch {
    throw new Error("Invalid DATABASE_URL format for PostgreSQL backup.");
  }

  const host = dbUrl.hostname || "localhost";
  const port = dbUrl.port || "5432";
  const username = dbUrl.username || "postgres";
  const password = decodeURIComponent(dbUrl.password || "");
  const database = dbUrl.pathname.slice(1) || "rsvp-to-me";

  try {
    await execFileAsync(
      "pg_dump",
      ["-h", host, "-p", port, "-U", username, "-f", outputPath, database],
      { env: { ...process.env, PGPASSWORD: password } }
    );
    console.log(`[backup] PostgreSQL backup successful: ${filename}`);
  } catch (err) {
    console.error("[backup] pg_dump execution failed:", err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`pg_dump failed: ${msg}`);
  }

  try {
    await db.systemConfig.upsert({
      where: { key: "last_backup_time" },
      update: { value: new Date().toISOString() },
      create: { key: "last_backup_time", value: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[backup] Failed to update last_backup_time in DB:", err);
  }

  await rotateBackups();
  return filename;
}

async function rotateBackups(): Promise<void> {
  const keepCount = await getBackupKeepCount();
  console.log("[backup] Rotating backups. Keeping last %d files...", keepCount);

  const list = await listBackups();
  if (list.length <= keepCount) return;

  const toDelete = list.slice(keepCount);
  for (const item of toDelete) {
    const filePath = path.join(BACKUPS_DIR, item.filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("[backup] Deleted old backup file: %s", item.filename);
      }
    } catch (err) {
      console.error("[backup] Failed to delete old backup %s:", item.filename, err);
    }
  }
}

export async function deleteBackup(filename: string): Promise<boolean> {
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("[backup] Manually deleted backup file: %s", safeFilename);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[backup] Failed to delete backup file %s:", safeFilename, err);
    return false;
  }
}

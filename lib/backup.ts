import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "./db";

const execAsync = promisify(exec);
const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}

/**
 * Gets the retention limit (backup_keep_count) from DB or env variables.
 */
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

/**
 * Lists all available backup files sorted newest first.
 */
export async function listBackups(): Promise<BackupFile[]> {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return [];
  }

  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    const backups: BackupFile[] = [];

    for (const file of files) {
      // Accept backup_*.sql and backup_*.sqlite files
      if (file.startsWith("backup_") && (file.endsWith(".sql") || file.endsWith(".sqlite"))) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        backups.push({
          filename: file,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
        });
      }
    }

    // Sort newest first
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    console.error("[backup] Failed to list backups:", err);
    return [];
  }
}

/**
 * Triggers a manual database backup and performs automatic rotation.
 */
export async function runBackup(): Promise<string> {
  // Ensure directory exists
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const url = process.env.DATABASE_URL || "";
  const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  
  let filename = "";
  let outputPath = "";

  if (isPostgres) {
    filename = `backup_${timestamp}.sql`;
    outputPath = path.join(BACKUPS_DIR, filename);

    console.log(`[backup] Starting PostgreSQL backup to ${filename}...`);
    
    // Parse PostgreSQL URL credentials using the URL class
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

    // Set PGPASSWORD environment variable to handle authentication securely
    const cmd = `pg_dump -h "${host}" -p "${port}" -U "${username}" -f "${outputPath}" "${database}"`;
    
    try {
      await execAsync(cmd, {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
      });
      console.log(`[backup] PostgreSQL backup successful: ${filename}`);
    } catch (err) {
      console.error("[backup] pg_dump execution failed:", err);
      // Clean up failed file if it was created
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`pg_dump failed: ${msg}`);
    }
  } else {
    // SQLite backup
    filename = `backup_${timestamp}.sqlite`;
    outputPath = path.join(BACKUPS_DIR, filename);

    console.log(`[backup] Starting SQLite backup to ${filename}...`);
    // SQLite database path is in data/prod.db inside the container by default
    const sqlitePath = path.join(process.cwd(), "data", "prod.db");
    
    if (!fs.existsSync(sqlitePath)) {
      throw new Error(`SQLite database file not found at: ${sqlitePath}`);
    }

    try {
      fs.copyFileSync(sqlitePath, outputPath);
      console.log(`[backup] SQLite backup successful: ${filename}`);
    } catch (err) {
      console.error("[backup] SQLite clone failed:", err);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite backup copy failed: ${msg}`);
    }
  }

  // Update last backup timestamp in system configuration
  try {
    await db.systemConfig.upsert({
      where: { key: "last_backup_time" },
      update: { value: new Date().toISOString() },
      create: { key: "last_backup_time", value: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[backup] Failed to update last_backup_time in DB:", err);
  }

  // Perform rotation
  await rotateBackups();

  return filename;
}

/**
 * Rotates database backups to keep only the configured count.
 */
async function rotateBackups(): Promise<void> {
  const keepCount = await getBackupKeepCount();
  console.log(`[backup] Rotating backups. Keeping last ${keepCount} files...`);

  const list = await listBackups();
  if (list.length <= keepCount) {
    return;
  }

  // Files are sorted newest first, so we delete from index `keepCount` to end
  const toDelete = list.slice(keepCount);
  for (const item of toDelete) {
    const filePath = path.join(BACKUPS_DIR, item.filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[backup] Deleted old backup file: ${item.filename}`);
      }
    } catch (err) {
      console.error(`[backup] Failed to delete old backup ${item.filename}:`, err);
    }
  }
}

/**
 * Deletes a single backup file by name. Includes directory traversal protection.
 */
export async function deleteBackup(filename: string): Promise<boolean> {
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[backup] Manually deleted backup file: ${safeFilename}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[backup] Failed to delete backup file ${safeFilename}:`, err);
    return false;
  }
}

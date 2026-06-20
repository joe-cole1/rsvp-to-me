import "dotenv/config";
import cron from "node-cron";
import { processReminders } from "../lib/reminders";
import { runBackup } from "../lib/backup";
import { db } from "../lib/db";

console.log("[cron] Reminder scheduler started — running every 15 minutes");

// Run immediately on startup to catch any reminders that fired while the container was down
processReminders().catch((err) => console.error("[cron] Startup check failed:", err));

cron.schedule("*/15 * * * *", () => {
  processReminders().catch((err) => console.error("[cron] Check failed:", err));
});

// Dynamic database backup scheduler
let currentBackupSchedule = "";
let backupTask: ReturnType<typeof cron.schedule> | null = null;

async function syncBackupJob() {
  let schedule = process.env.BACKUP_SCHEDULE || "";
  
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: "backup_schedule" },
    });
    if (config?.value) {
      schedule = config.value.trim();
    }
  } catch {
    // Fail silently (e.g. during initial DB schema load)
  }

  if (schedule !== currentBackupSchedule) {
    if (backupTask) {
      console.log("[cron] Stopping existing database backup task...");
      backupTask.stop();
      backupTask = null;
    }
    
    currentBackupSchedule = schedule;

    if (schedule && schedule !== "disabled" && schedule !== "false") {
      console.log(`[cron] Scheduling database backup job with pattern: "${schedule}"`);
      try {
        if (cron.validate(schedule)) {
          backupTask = cron.schedule(schedule, () => {
            console.log("[cron] Starting scheduled database backup...");
            runBackup().catch((err) => console.error("[cron] Scheduled database backup failed:", err));
          });
        } else {
          console.error(`[cron] Invalid database backup cron pattern: "${schedule}"`);
        }
      } catch (err) {
        console.error("[cron] Failed to schedule database backup cron:", err);
      }
    } else {
      console.log("[cron] Automated database backups are disabled.");
    }
  }
}

// Initial sync on startup
syncBackupJob().catch((err) => console.error("[cron] Initial backup sync failed:", err));

// Check and sync backup schedule configuration every minute
cron.schedule("* * * * *", () => {
  syncBackupJob().catch((err) => console.error("[cron] Sync backup job failed:", err));
});


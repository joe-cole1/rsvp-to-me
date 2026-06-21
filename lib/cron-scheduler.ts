import cron from "node-cron";
import { processReminders } from "./reminders";
import { runBackup } from "./backup";
import { db } from "./db";

console.log("[cron-scheduler] Module loaded");

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
      console.log("[cron-scheduler] Stopping existing database backup task...");
      backupTask.stop();
      backupTask = null;
    }
    
    currentBackupSchedule = schedule;

    if (schedule && schedule !== "disabled" && schedule !== "false") {
      console.log("[cron-scheduler] Scheduling database backup job with pattern: \"%s\"", schedule);
      try {
        if (cron.validate(schedule)) {
          backupTask = cron.schedule(schedule, () => {
            console.log("[cron-scheduler] Starting scheduled database backup...");
            runBackup().catch((err) => console.error("[cron-scheduler] Scheduled database backup failed:", err));
          });
        } else {
          console.error("[cron-scheduler] Invalid database backup cron pattern: \"%s\"", schedule);
        }
      } catch (err) {
        console.error("[cron-scheduler] Failed to schedule database backup cron:", err);
      }
    } else {
      console.log("[cron-scheduler] Automated database backups are disabled.");
    }
  }
}

export async function startInProcessCron() {
  console.log("[cron-scheduler] In-process reminder & backup scheduler starting...");

  // Run reminders immediately on startup
  processReminders().catch((err) => console.error("[cron-scheduler] Startup reminders check failed:", err));

  // Schedule reminders check every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    processReminders().catch((err) => console.error("[cron-scheduler] Reminders check failed:", err));
  });

  // Initial backup schedule sync
  await syncBackupJob().catch((err) => console.error("[cron-scheduler] Initial backup sync failed:", err));

  // Sync backup schedule config every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    syncBackupJob().catch((err) => console.error("[cron-scheduler] Sync backup job failed:", err));
  });
}

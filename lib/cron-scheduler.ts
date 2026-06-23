import cron from "node-cron";
import { processReminders } from "./reminders";
import { runBackup } from "./backup";
import { db } from "./db";

async function processExpiredDeletions() {
  const now = new Date();
  const pending = await db.user.findMany({
    where: { deletionScheduledAt: { lte: now, not: null } },
    select: { id: true, name: true, email: true },
  });

  if (pending.length === 0) return;
  console.log(`[cron-scheduler] Processing ${pending.length} expired account deletion(s)...`);

  for (const user of pending) {
    const upcomingEvents = await db.event.count({
      where: { hostId: user.id, status: "PUBLISHED", startAt: { gt: now } },
    });

    if (upcomingEvents > 0) {
      console.warn(`[cron-scheduler] Skipping deletion for user ${user.id} — still has ${upcomingEvents} upcoming published event(s).`);
      continue;
    }

    // Reassign past events to the SYSTEM tombstone user
    await db.event.updateMany({ where: { hostId: user.id }, data: { hostId: "system" } });

    // Anonymize PII
    await db.user.update({
      where: { id: user.id },
      data: {
        email: null,
        phone: null,
        name: "Deleted User",
        avatarUrl: null,
        role: "GUEST",
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      },
    });

    console.log(`[cron-scheduler] Anonymized account for user ${user.id} (was: ${user.email ?? user.name}).`);
  }
}

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

  // Run account deletion processing on startup and once daily
  processExpiredDeletions().catch((err) => console.error("[cron-scheduler] Startup account deletion check failed:", err));
  cron.schedule("0 0 * * *", () => {
    processExpiredDeletions().catch((err) => console.error("[cron-scheduler] Account deletion processing failed:", err));
  });

  // Initial backup schedule sync
  await syncBackupJob().catch((err) => console.error("[cron-scheduler] Initial backup sync failed:", err));

  // Sync backup schedule config every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    syncBackupJob().catch((err) => console.error("[cron-scheduler] Sync backup job failed:", err));
  });
}
